#!/usr/bin/env python3
"""
LazySloth Cleaner - Local Gemma / PaliGemma Companion Service

Runs a privacy-preserving loopback HTTP service on 127.0.0.1:5001 that provides
genuine PaliGemma vision-language model inference for LazySloth Cleaner.

Key Safety & Privacy Guarantees:
1. Local Loopback Only: Binds exclusively to 127.0.0.1 (never exposed to external networks).
2. Zero Silent Downloads: Does NOT download multi-gigabyte model weights unless --load-model
   is explicitly specified by the user with authorized Hugging Face credentials.
3. Gated Model Transparency: Honestly discloses when weights are missing or gated.
4. Privacy: Images are processed entirely in local memory and never saved or transmitted.
"""

import os
import sys
import argparse
import io
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image

app = Flask(__name__)
# Enable CORS for local development and Render static preview
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8080", "https://*.onrender.com"]}})

# Global runtime state
MODEL_STATE = {
    "loaded": False,
    "model_name": "PaliGemma 3B (google/paligemma-3b-pt-224)",
    "model_id": "google/paligemma-3b-pt-224",
    "device": "cpu",
    "processor": None,
    "model": None,
    "test_mode": False,
    "blocker_reason": (
        "PaliGemma weights are not loaded. Google's PaliGemma 3B is a gated model requiring "
        "acceptance of the Google Gemma Terms of Use on Hugging Face (https://huggingface.co/google/paligemma-3b-pt-224) "
        "and logging in via 'huggingface-cli login'. Download size is ~5.8 GB (fp16) or ~2 GB (quantized)."
    )
}

def load_paligemma_model(model_path_or_id, device="cpu"):
    """
    Attempts to load genuine PaliGemma weights using Hugging Face Transformers.
    """
    try:
        import torch
        from transformers import AutoProcessor, PaliGemmaForConditionalGeneration

        print(f"[Companion] Loading PaliGemma model from: {model_path_or_id} on {device}...")
        processor = AutoProcessor.from_pretrained(model_path_or_id)
        
        dtype = torch.float32 if device == "cpu" else torch.float16
        model = PaliGemmaForConditionalGeneration.from_pretrained(
            model_path_or_id,
            torch_dtype=dtype,
            device_map=device
        )
        model.eval()

        MODEL_STATE["loaded"] = True
        MODEL_STATE["model_name"] = f"PaliGemma 3B ({os.path.basename(model_path_or_id)})"
        MODEL_STATE["device"] = device
        MODEL_STATE["processor"] = processor
        MODEL_STATE["model"] = model
        MODEL_STATE["blocker_reason"] = None
        print(f"[Companion] Model {MODEL_STATE['model_name']} loaded successfully on {device}!")
        return True, "Loaded successfully"
    except Exception as e:
        error_msg = str(e)
        print(f"[Companion] Model load halted: {error_msg}")
        MODEL_STATE["loaded"] = False
        MODEL_STATE["blocker_reason"] = error_msg
        return False, error_msg

@app.route("/", methods=["GET"])
@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint queried by LazySloth Cleaner frontend."""
    if MODEL_STATE["loaded"]:
        return jsonify({
            "status": "ok",
            "modelName": MODEL_STATE["model_name"],
            "modelLoaded": True,
            "type": "multimodal",
            "device": MODEL_STATE["device"],
            "runtime": "python-transformers",
            "supportsImages": True
        })
    elif MODEL_STATE["test_mode"]:
        return jsonify({
            "status": "ok",
            "modelName": "PaliGemma-3B-TestMode",
            "modelLoaded": True,
            "type": "multimodal",
            "device": "cpu",
            "runtime": "python-test-mode",
            "supportsImages": True
        })
    else:
        return jsonify({
            "status": "unconfigured",
            "modelName": MODEL_STATE["model_name"],
            "modelLoaded": False,
            "type": "multimodal",
            "blocker": MODEL_STATE["blocker_reason"],
            "runtime": "python-transformers"
        }), 503

@app.route("/classify", methods=["POST"])
def classify():
    """
    Image classification endpoint. Accepts multipart/form-data with 'file'.
    Runs genuine PaliGemma inference if model is loaded.
    """
    if "file" not in request.files:
        return jsonify({"error": "No image file provided in request"}), 400

    file = request.files["file"]
    filename = file.filename or "uploaded.jpg"

    try:
        image_bytes = file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        return jsonify({"error": f"Failed to parse image file: {str(e)}"}), 400

    # Test Mode Handler (for automated contract testing without multi-GB weights)
    if MODEL_STATE["test_mode"]:
        lower_name = filename.lower()
        is_doc = any(k in lower_name for k in ["doc", "note", "study", "lecture", "receipt", "bill"])
        is_meme = any(k in lower_name for k in ["meme", "reddit", "discord"])
        
        category = "documents" if is_doc else ("memes" if is_meme else "photos")
        confidence = 0.92 if is_doc else 0.85
        keep_safe = is_doc

        return jsonify({
            "category": category,
            "confidence": confidence,
            "keepSafe": keep_safe,
            "explanation": f"Test-mode PaliGemma classification: detected {category} features.",
            "model": "PaliGemma-3B-TestMode"
        })

    # Real PaliGemma Inference
    if not MODEL_STATE["loaded"]:
        return jsonify({
            "error": "Model weights are not loaded.",
            "blocker": MODEL_STATE["blocker_reason"]
        }), 503

    try:
        import torch
        processor = MODEL_STATE["processor"]
        model = MODEL_STATE["model"]
        device = MODEL_STATE["device"]

        # Prompt PaliGemma to caption and categorize the image
        prompt = "caption en"
        inputs = processor(text=prompt, images=image, return_tensors="pt")
        if device == "cuda":
            inputs = {k: v.to("cuda") for k, v in inputs.items()}

        with torch.no_grad():
            outputs = model.generate(**inputs, max_new_tokens=30)
            decoded = processor.decode(outputs[0], skip_special_tokens=True).strip()

        # Parse model generation into categories
        lower_gen = decoded.lower()
        is_document = any(w in lower_gen for w in ["document", "receipt", "text", "paper", "note", "letter", "page", "invoice", "screen", "whiteboard"])
        is_meme = any(w in lower_gen for w in ["meme", "cartoon", "drawing", "illustration", "graphic", "text overlay"])

        if is_document:
            category = "documents"
            keep_safe = True
            confidence = 0.88
        elif is_meme:
            category = "memes"
            keep_safe = False
            confidence = 0.82
        else:
            category = "photos"
            keep_safe = False
            confidence = 0.85

        return jsonify({
            "category": category,
            "confidence": confidence,
            "keepSafe": keep_safe,
            "rawOutput": decoded,
            "explanation": f"PaliGemma visual inspection generated: '{decoded}'. Categorized as {category}.",
            "model": MODEL_STATE["model_name"]
        })

    except Exception as e:
        return jsonify({"error": f"Inference execution failed: {str(e)}"}), 500

def main():
    parser = argparse.ArgumentParser(description="LazySloth Cleaner - Gemma/PaliGemma Companion Service")
    parser.add_argument("--port", type=int, default=5001, help="Port to listen on (default: 5001)")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host interface (default: 127.0.0.1)")
    parser.add_argument("--model-path", type=str, default="google/paligemma-3b-pt-224", help="Hugging Face repo or local path")
    parser.add_argument("--device", type=str, default=None, help="Inference device: 'cpu' or 'cuda' (auto-detected if omitted)")
    parser.add_argument("--load-model", action="store_true", help="Explicitly trigger model loading (requires authorized Hugging Face token)")
    parser.add_argument("--test-mode", action="store_true", help="Run in test mode for automated contract testing")
    args = parser.parse_args()

    # Determine device
    if args.device:
        device = args.device
    else:
        try:
            import torch
            device = "cuda" if torch.cuda.is_available() else "cpu"
        except Exception:
            device = "cpu"

    MODEL_STATE["device"] = device
    MODEL_STATE["test_mode"] = args.test_mode

    if args.load_model:
        print("[Companion] User specified --load-model. Attempting model load...")
        load_paligemma_model(args.model_path, device=device)
    elif args.test_mode:
        print("[Companion] Running in --test-mode (mocked inference for contract testing).")
    else:
        print("[Companion] Starting in standby mode. Model weights are not loaded by default to avoid downloading multi-GB files without explicit consent.")
        print(f"[Companion] Notice: {MODEL_STATE['blocker_reason']}")

    print(f"[Companion] Server listening on http://{args.host}:{args.port}")
    app.run(host=args.host, port=args.port, debug=False)

if __name__ == "__main__":
    main()
