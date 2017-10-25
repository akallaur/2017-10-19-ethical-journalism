GENERATED_FILES = \
	~/Development/keys/511847675586-dvu01fndl7cf8nvqhce6j9tuhbgt10rf.json \
	build/style.css \
	data \
	public/index.html \
	public/_assets/build.js

all: .gitignore .gitattributes $(GENERATED_FILES)

article:
	@echo "\033[31mWARNING: Please use 'make download' instead of 'make article'\033[0m"
	bin/render-template -o public/index.html --download

clean:
	rm -f $(GENERATED_FILES)

.PHONY: public/index.html download

.gitignore:
	cp -n gitignore .gitignore 2>/dev/null || :
	rm -f gitignore

.gitattributes:
	cp -n gitattributes .gitattributes 2>/dev/null || :
	rm -f gitattributes

public/_assets/build.js: src/* src/**/* require-config.js
	node_modules/.bin/r.js -o require-config.js out=$@ name=script

build/style.css: src/* src/**/*
ifeq (,$(wildcard src/style.less))
	node_modules/.bin/r.js -o cssIn=src/style.css out=$@
else
	node_modules/less/bin/lessc src/style.less > $@
endif

data:
	mkdir -p data
	make download

public/index.html: bin/render-template config.yml src/*
	@mkdir -p data
	@mkdir -p page-templates
	bin/render-template -o $@

scoop:
	@echo "\033[31mWARNING: Please use 'make download' instead of 'make scoop'\033[0m"
	bin/render-template -o public/index.html --download

download:
	bin/render-template -o public/index.html --download

# Google Spreadsheet credentials
~/Development/keys/511847675586-dvu01fndl7cf8nvqhce6j9tuhbgt10rf.json:
	node_modules/.bin/nytg-dataloader-setup


# ASSETS
images: install-assets.txt
	@type convert >/dev/null 2>&1 || { echo >&2 "\033[31mWARNING:\033[0m Imagemagick required. To install, run:\"brew install imagemagick\""; exit 1; }
	@type pngquant >/dev/null 2>&1 || { echo >&2 "\033[31mWARNING:\033[0m pngquant required for PNG files. To install, run:\"brew install pngquant\""; }
	@bin/image-sizer -d

encode: install-assets.txt
	@type ffprobe >/dev/null 2>&1 || { echo >&2 "\033[31mWARNING:\033[0m ffprobe required. To install, run:\"brew install ffmpeg\""; exit 1; }
	@bin/video-sizer -d

sprite: install-assets.txt
	@bin/sprite-generator

install-assets:
	./bin/install-assets.sh
	echo "Success." > install-assets.txt

related:
	mkdir -p data
	mkdir -p data/related_assets
	@bin/get-related-assets
	bin/render-template -o public/index.html

# Verifies that you installed assets locally
install-assets.txt:
	make install-assets
