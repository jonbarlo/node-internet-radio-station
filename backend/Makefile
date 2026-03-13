# Radio backend – run from backend/ (where this Makefile lives).
# Requires: Node, npm, ffmpeg (for generate-hls).
#
# Put MP3s in backend/samples/channel-1/ and backend/samples/channel-2/, then:
#   make generate-hls CHANNEL=channel-1 INPUT=./samples/channel-1
#   make generate-hls CHANNEL=channel-2 INPUT=./samples/channel-2
#   make build
#   make dev

.PHONY: help build dev start generate-hls check-audio-meta export-tracks deploy-mochahost install

help:
	@echo "Radio backend – targets:"
	@echo "  make install           - npm install"
	@echo "  make build             - compile TypeScript to dist/"
	@echo "  make dev               - run dev server (ts-node-dev)"
	@echo "  make start             - run production (node dist/server.js)"
	@echo "  make generate-hls      - generate HLS for one channel (requires CHANNEL and INPUT)"
	@echo "  make check-audio-meta  - report title/artist/album/cover in samples/channel-*"
	@echo "  make export-tracks     - write channels/*/tracks.json for player metadata"
	@echo "  make deploy-mochahost  - build and deploy to Mochahost via FTP (.env.prod)"
	@echo ""
	@echo "Generate HLS (put MP3s in backend/samples/channel-1 and samples/channel-2):"
	@echo "  make generate-hls CHANNEL=channel-1 INPUT=./samples/channel-1"
	@echo "  make generate-hls CHANNEL=channel-2 INPUT=./samples/channel-2"

install:
	npm install

build:
	npm run build

dev:
	npm run dev

start:
	npm run start

# Generate HLS. Put your MP3s in backend/samples/channel-1/ and samples/channel-2/.
generate-hls:
ifndef CHANNEL
	$(error CHANNEL is required. Use CHANNEL=channel-1 or CHANNEL=channel-2)
endif
ifndef INPUT
	$(error INPUT is required. Use INPUT=./samples/channel-1 or INPUT=./samples/channel-2)
endif
	npm run generate-hls -- $(CHANNEL) $(INPUT)

check-audio-meta:
	npm run check-audio-meta

export-tracks:
	npm run export-tracks

deploy-mochahost:
	npm run deploy-mochahost
