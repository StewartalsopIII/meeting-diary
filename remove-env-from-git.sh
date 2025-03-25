#!/bin/bash

# This script removes .env files from Git tracking while keeping them locally
# Run this script from the project root directory

echo "Removing .env files from Git tracking..."

# Remove the .env file from Git tracking but keep it locally
git rm --cached frontend/.env

echo "Done! The .env files are now untracked by Git but still exist locally."
echo "Make sure to commit these changes to make the .gitignore rules take effect."
