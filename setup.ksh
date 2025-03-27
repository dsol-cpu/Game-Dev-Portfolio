#!/bin/ksh

VENV_DIR=".venv"

# Check if Git is working correctly (i.e., we're in a git repository)
if [ "$(git rev-parse --is-inside-work-tree)" = "false" ]; then
  echo "Not in a git repository"
  exit 1
fi

# Check if the virtual environment is already set up
if [ -f "$VENV_DIR/activate" ]; then
  echo "Virtual environment '$VENV_DIR' is already active."
else
  # Create the virtual environment
  echo "Creating Python virtual environment: $VENV_DIR"
  python3 -m venv "$VENV_DIR"
  source $VENV_DIR/bin/activate

  if [ $? -eq 0 ]; then
    echo "Virtual environment '$VENV_DIR' is now active."
  else
    echo "Failed to activate virtual environment. Exiting..."
    exit 1
  fi
fi

# Check if ggshield is already installed
if ! pip show ggshield >/dev/null 2>&1; then
  echo "Installing ggshield..."
  pip install ggshield
else
  echo "ggshield is already installed."
fi
