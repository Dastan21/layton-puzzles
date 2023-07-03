import sys
from os import listdir
from os.path import exists

from PIL import Image

puzzles_folder = 'puzzles'

try:
    game = sys.argv[1]
    if len(sys.argv) > 2:
        puzzles_folder = sys.argv[2]
except:
    print(f'Usage: {sys.argv[0]} GAME_NAME [FOLDER=\'puzzles\']')
    exit(0)

game_path = 'public/assets/' + game + '/'
if exists(game_path) is not True:
    print(f'Path not found: {game_path}')
    exit(0)


puzzles_path = game_path + puzzles_folder + '/'
files = [ puzzles_path + file for file in listdir(puzzles_path)]
puzzles_num = len(files)
bg_color = (71, 42, 17)

def combine_images(columns, space, images):
    rows = len(images) // columns
    if len(images) % columns:
        rows += 1
    width_max = max([Image.open(image).width for image in images])
    height_max = max([Image.open(image).height for image in images])
    background_width = width_max * columns + (space * columns) - space
    background_height = height_max * rows + (space * rows) - space
    background = Image.new('RGB', (background_width, background_height), bg_color)
    x = 0
    y = 0
    for i, image in enumerate(images):
        img = Image.open(image)
        x_offset = int((width_max - img.width) / 2)
        y_offset = int((height_max - img.height) / 2)
        background.paste(img, (x + x_offset, y + y_offset))
        x += width_max + space
        if (i + 1) % columns == 0:
            y += height_max + space
            x = 0
    background.save(game_path + puzzles_folder + '.jpg')

combine_images(columns=10, space=0, images=files)
print(f'Combined {puzzles_num} images!')