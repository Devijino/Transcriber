#!/bin/bash
# Script to download the NLLB model
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Downloading NLLB model (this might take a while)...${NC}"

# Ensure models directory exists
MODELS_DIR="./src/models"
mkdir -p $MODELS_DIR

# Activate the virtual environment
source ./venv/bin/activate

# Fix for common import issues
pip install --upgrade pip
pip install --force-reinstall torch --index-url https://download.pytorch.org/whl/cpu
pip install sentencepiece protobuf==3.20.3 accelerate safetensors transformers

# Download the model with a detailed approach and more error handling
python3 -c "
import os
import sys
from huggingface_hub import snapshot_download

try:
    print('Trying to download NLLB model using snapshot_download')
    model_dir = './src/models/nllb_model'
    os.makedirs(model_dir, exist_ok=True)
    
    print('Downloading tokenizer first...')
    snapshot_download(
        repo_id='facebook/nllb-200-distilled-600M',
        local_dir=model_dir,
        local_dir_use_symlinks=False,
        allow_patterns=['tokenizer*', 'vocab*', 'spiece*', 'sentencepiece*'],
    )
    
    print('Tokenizer downloaded, now downloading model files...')
    snapshot_download(
        repo_id='facebook/nllb-200-distilled-600M',
        local_dir=model_dir,
        local_dir_use_symlinks=False,
        allow_patterns=['*.bin', '*.json', 'config*'],
    )
    print('Model downloaded successfully!')
except Exception as e:
    print(f'Error downloading model: {str(e)}', file=sys.stderr)
    sys.exit(1)
"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Model downloaded successfully!${NC}"
    echo -e "${GREEN}You can now use the NLLB model for translation.${NC}"
else
    echo -e "${RED}Failed to download model.${NC}"
    echo -e "${YELLOW}The system will continue to use the simple dictionary translation.${NC}"
    exit 1
fi

# Update the API to use the new model
echo -e "${YELLOW}Updating API to use the new model...${NC}"

# Make sure the API uses our local model path for NLLB
sed -i 's|self.model_name = "facebook/nllb-200-distilled-600M"|self.model_name = "./src/models/nllb_model"|g' src/lib/python/nllb_translator.py

echo -e "${GREEN}NLLB model is set up and ready to use!${NC}"
echo -e "${GREEN}Restart the server to use the new model.${NC}"
