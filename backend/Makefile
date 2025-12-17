# ===============================
# Makefile inside backend/
# ===============================

FRONTEND_DIR := ..
BACKEND_DIR := .
DEPLOY_DIR := deploy
STATIC_DIR := app/static
ZIP_NAME := backend-$(shell date +%Y%m%d%H%M%S).zip

VITE_API_URL := http://turbosap-py312-env.eba-5hg7r3id.us-east-2.elasticbeanstalk.com

# ===============================
# default_code. Build the frontend
# ===============================
build-frontend:
	@echo "==> Building frontend with VITE_API_URL=$(VITE_API_URL)"
	cd $(FRONTEND_DIR) && VITE_API_URL=$(VITE_API_URL) npm run build

# ===============================
# 2. Copy dist → backend/app/static
# ===============================
copy-static:
	@echo "==> Copying dist → $(STATIC_DIR)"
	rm -rf $(STATIC_DIR)
	mkdir -p $(STATIC_DIR)
	cp -a $(FRONTEND_DIR)/dist/. $(STATIC_DIR)/

# ===============================
# 3. Zip backend directory
# ===============================
package-backend:
	@echo "==> Zipping backend → $(DEPLOY_DIR)/$(ZIP_NAME)"
	mkdir -p $(DEPLOY_DIR)
	uv pip compile pyproject.toml -o requirements.txt

	zip -r "$(DEPLOY_DIR)/$(ZIP_NAME)" . \
		-x "deploy/*" \
		-x "*.zip" \
		-x "__pycache__/*" \
		-x "*.pyc"

# ===============================
# 4. Full pipeline
# ===============================
deploy: build-frontend copy-static package-backend
	@echo "==> Deployment package created: $(DEPLOY_DIR)/$(ZIP_NAME)"
