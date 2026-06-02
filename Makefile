WASM_DIR = target/wasm32v1-none/release
NETWORK = testnet
SOURCE = oort-deployer

.PHONY: build optimize test clean deploy-testnet sizes

build:
	cargo build --target wasm32v1-none --release

optimize: build
	stellar contract optimize --wasm $(WASM_DIR)/oort_core.wasm
	stellar contract optimize --wasm $(WASM_DIR)/oort_mock_oracle.wasm
	stellar contract optimize --wasm $(WASM_DIR)/oort_price_verifier.wasm
	@echo "── Optimized sizes ──"
	@ls -la $(WASM_DIR)/*.optimized.wasm

test:
	cargo test

sizes: build
	@echo "── Raw WASM sizes ──"
	@ls -la $(WASM_DIR)/oort_core.wasm $(WASM_DIR)/oort_mock_oracle.wasm $(WASM_DIR)/oort_price_verifier.wasm
	@echo ""
	@echo "64KB limit = 65536 bytes"

deploy-testnet: optimize
	@echo "── Deploying oort-mock-oracle ──"
	stellar contract deploy \
		--wasm $(WASM_DIR)/oort_mock_oracle.optimized.wasm \
		--source-account $(SOURCE) --network $(NETWORK)
	@echo ""
	@echo "── Deploying oort-core ──"
	stellar contract deploy \
		--wasm $(WASM_DIR)/oort_core.optimized.wasm \
		--source-account $(SOURCE) --network $(NETWORK)

clean:
	cargo clean
