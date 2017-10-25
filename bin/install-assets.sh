#!/bin/bash
YARNFILE=`pwd`'/yarn.lock';

mkdir -p assets/images/done
mkdir -p assets/video/done
mkdir -p assets/sprite
mkdir -p public/_big_assets/images
mkdir -p tmp
touch assets/images/done/.gitkeep
touch assets/video/done/.gitkeep
touch assets/sprite/.gitkeep

if [ -f $YARNFILE ]; then
  echo "Installing with Yarn"
  CMD="yarn add"
else
  echo "Installing with NPM"
  CMD="npm install"
fi

declare -a modules=("laziestloader" "js-yaml@~3.0.1" "image-size@^0.5.0" "commander@^2.9.0" "winston@^2.2.0" "mkdirp@^0.5.1" "node-sprite-generator@^0.10.2" "newsdev/videotape")

for module in "${modules[@]}"
do
  $CMD "$module" --save
done