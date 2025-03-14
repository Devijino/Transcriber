#!/bin/bash

# Script to set up a virtual environment for NLLB translation model

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting up virtual environment for NLLB translation model...${NC}"

# Check if python3-venv is installed
if ! dpkg -l | grep -q python3-venv; then
    echo -e "${YELLOW}Installing python3-venv...${NC}"
    sudo apt update
    sudo apt install -y python3-venv python3-pip
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install python3-venv. Please install it manually.${NC}"
        exit 1
    fi
fi

# Remove previous virtual environment if it exists
VENV_DIR="./venv"
if [ -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}Removing old virtual environment...${NC}"
    rm -rf $VENV_DIR
fi

# Create new virtual environment
echo -e "${YELLOW}Creating new virtual environment in $VENV_DIR...${NC}"
python3 -m venv $VENV_DIR
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to create virtual environment. Trying alternative approach...${NC}"
    # Fallback: create using system packages
    python3 -m venv $VENV_DIR --system-site-packages
    if [ $? -ne 0 ]; then
        echo -e "${RED}All attempts to create virtual environment failed.${NC}"
        echo -e "${YELLOW}We'll continue with limited dictionary translation.${NC}"
        exit 1
    fi
fi

# Activate the virtual environment
echo -e "${YELLOW}Activating virtual environment...${NC}"
source $VENV_DIR/bin/activate

# Install required packages
echo -e "${YELLOW}Installing required packages...${NC}"
# First update pip itself to latest version
pip install --upgrade pip

# Install packages one by one to better isolate failures
echo -e "${YELLOW}Installing transformers...${NC}"
pip install transformers
echo -e "${YELLOW}Installing torch...${NC}"
pip install torch --index-url https://download.pytorch.org/whl/cpu
echo -e "${YELLOW}Installing sentencepiece...${NC}"
pip install sentencepiece
echo -e "${YELLOW}Installing accelerate...${NC}"
pip install accelerate
echo -e "${YELLOW}Installing protobuf...${NC}"
pip install protobuf==3.20.3
echo -e "${YELLOW}Installing safetensors...${NC}"
pip install safetensors

# Create a models directory if it doesn't exist
MODELS_DIR="./src/models"
if [ ! -d "$MODELS_DIR" ]; then
    echo -e "${YELLOW}Creating models directory...${NC}"
    mkdir -p $MODELS_DIR
fi

# Create script to run Python with the virtual environment
cat > run_venv_python.sh << 'EOF'
#!/bin/bash
# Script to run Python commands with the virtual environment
source ./venv/bin/activate
python "$@"
EOF

chmod +x run_venv_python.sh

# Create configuration file with venv path
echo "VENV_PATH=$(pwd)/venv" > .env

echo -e "${GREEN}Setup complete!${NC}"
echo -e "${YELLOW}The script to download the model will be created separately to avoid memory issues.${NC}"
echo -e "${YELLOW}To run the model download script later, use: ./download_nllb_model.sh${NC}"

# Create model download script
cat > download_nllb_model.sh << 'EOF'
#!/bin/bash
# Script to download the NLLB model
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Downloading NLLB model (this might take a while)...${NC}"

# Activate the virtual environment
source ./venv/bin/activate

# Download the model
python3 -c "
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

# Download the model and tokenizer
model_name = 'facebook/nllb-200-distilled-600M'
print(f'Downloading model: {model_name}')
tokenizer = AutoTokenizer.from_pretrained(model_name, cache_dir='./src/models')
model = AutoModelForSeq2SeqLM.from_pretrained(model_name, cache_dir='./src/models')
print('Model downloaded successfully!')
"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Model downloaded successfully!${NC}"
else
    echo -e "${RED}Failed to download model.${NC}"
    echo -e "${YELLOW}The system will continue to use the simple dictionary translation.${NC}"
fi
EOF

chmod +x download_nllb_model.sh

echo -e "${GREEN}Use './run_venv_python.sh script.py' to run Python scripts with this environment.${NC}"
echo -e "${GREEN}Use './download_nllb_model.sh' to download the NLLB model when ready.${NC}" 