# Radio backend – run from backend/ (where this Makefile lives).
# Requires: Node, npm, ffmpeg (for generate-hls).
#
# Put MP3s (or video for channel-3) in backend/samples/channel-1/, channel-2/, channel-3/, then:
#   make generate-hls CHANNEL=channel-1 INPUT=./samples/channel-1
#   make generate-hls CHANNEL=channel-2 INPUT=./samples/channel-2
#   make generate-hls CHANNEL=channel-3 INPUT=./samples/channel-3
#   make build
#   make dev

.PHONY: help build dev start generate-hls generate-hls-video check-audio-meta export-tracks deploy-mochahost broadcast-hls-channel install

CHANNEL3_DIR := channels/channel-3

help:
	@echo "Radio backend – targets:"
	@echo "  make install             - npm install"
	@echo "  make build               - compile TypeScript to dist/"
	@echo "  make dev                 - run dev server (ts-node-dev)"
	@echo "  make start               - run production (node dist/server.js)"
	@echo "  make generate-hls        - generate HLS for one channel (requires CHANNEL and INPUT)"
	@echo "  make generate-hls-video  - convert video(s) to HLS for channel-3 (INPUT=file or folder)"
	@echo "  make check-audio-meta    - report title/artist/album/cover in samples/channel-*"
	@echo "  make export-tracks       - write channels/*/tracks.json for player metadata"
	@echo "  make deploy-mochahost    - build and deploy to Mochahost via FTP (.env.prod)"
	@echo "  make broadcast-hls-channel - broadcast HLS for one channel to FTP folders (requires CHANNEL=channel-1|channel-2|channel-3)"
	@echo ""
	@echo "Generate HLS (put MP3s in samples/channel-1, channel-2; video in channel-3):"
	@echo "  make generate-hls CHANNEL=channel-1 INPUT=./samples/channel-1"
	@echo "  make generate-hls CHANNEL=channel-2 INPUT=./samples/channel-2"
	@echo "  make generate-hls CHANNEL=channel-3 INPUT=./samples/channel-3"
	@echo ""
	@echo "Convert video(s) to HLS for channel-3 (single file or all videos in folder):"
	@echo "  make generate-hls-video INPUT=./samples/channel-3/yourfile.mp4"
	@echo "  make generate-hls-video INPUT=./samples/channel-3"
	@echo ""
	@echo "Broadcast HLS to channel folder on FTP:"
	@echo "  make broadcast-hls-channel CHANNEL=channel-1"
	@echo "  make broadcast-hls-channel CHANNEL=channel-2"
	@echo "  make broadcast-hls-channel CHANNEL=channel-3"

install:
	npm install

build:
	npm run build

dev:
	npm run dev

start:
	npm run start

# Generate HLS. Put your MP3s in samples/channel-1/, channel-2/; video in channel-3/.
generate-hls:
ifndef CHANNEL
	$(error CHANNEL is required. Use CHANNEL=channel-1, channel-2, or channel-3)
endif
ifndef INPUT
	$(error INPUT is required. Use INPUT=./samples/channel-1 or similar)
endif
	npm run generate-hls -- $(CHANNEL) $(INPUT)

# Convert video(s) to HLS for channel-3. INPUT = one file or a folder (all videos inside are concatenated).
# Output: channels/channel-3/playlist.m3u8 + segment*.ts
# Usage: make generate-hls-video INPUT=./samples/channel-3/276047_medium.mp4
#        make generate-hls-video INPUT=./samples/channel-3
generate-hls-video:
ifndef INPUT
	$(error INPUT is required. Use INPUT=./samples/channel-3 or INPUT=./samples/channel-3/file.mp4)
endif
	npm run generate-hls-video -- $(INPUT)

check-audio-meta:
	npm run check-audio-meta

export-tracks:
	npm run export-tracks

deploy-mochahost:
	npm run deploy-mochahost

# Broadcast HLS files for one channel to the FTP server (channels/<channel>/). Uses .env.prod.
broadcast-hls-channel:
ifndef CHANNEL
	$(error CHANNEL is required. Use CHANNEL=channel-1, channel-2, or channel-3)
endif
	npm run broadcast-hls-channel -- $(CHANNEL)
