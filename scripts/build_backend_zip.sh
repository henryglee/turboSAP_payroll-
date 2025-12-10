#!/usr/bin/env bash
set -euo pipefail

# Builds the frontend for production, syncs assets into the FastAPI static dir,
# and packages the backend into backend/deploy/*.zip for Elastic Beanstalk.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
STATIC_DIR="${BACKEND_DIR}/app/static"
DEPLOY_DIR="${BACKEND_DIR}/deploy"
ZIP_NAME="${DEPLOY_DIR}/backend-$(date +%Y%m%d%H%M%S).zip"

export APP_ENV="${APP_ENV:-production}"

echo "Building frontend (APP_ENV=${APP_ENV})..."
(cd "${ROOT_DIR}" && npm install && APP_ENV="${APP_ENV}" npm run build)

echo "Syncing dist -> ${STATIC_DIR}"
rm -rf "${STATIC_DIR}"
mkdir -p "${STATIC_DIR}"
cp -a "${ROOT_DIR}/dist/." "${STATIC_DIR}/"

echo "Packaging backend -> ${ZIP_NAME}"
mkdir -p "${DEPLOY_DIR}"
(cd "${BACKEND_DIR}" && zip -r "${ZIP_NAME}" app .ebextensions requirements.txt -x "*__pycache__*" "*.pyc")

echo "Done. Zip created at: ${ZIP_NAME}"
