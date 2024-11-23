import json
from pathlib import Path
from argparse import ArgumentParser
from nbformat.sign import NotebookNotary, yield_everything

parser = ArgumentParser()
parser.add_argument('dir', default='test/.cache/signatures', nargs='?')
parser.add_argument('-e', '--everything', action='store_true', help='save the output of yield_everything to file')

args = parser.parse_args()

dir = Path(args.dir)

if dir.exists():
    if not dir.is_dir():
        raise Exception(f'{dir} is not a directory')
                
dir.mkdir(parents=True, exist_ok=True)
notary = NotebookNotary(data_dir=str(dir), db_file=':memory:')

signatures = {}

for path in dir.iterdir():
    if path.name.startswith('test-') and path.suffix == '.json':
        with path.open(encoding='utf-8') as file:
            try:
                nb = json.load(file)
                if args.everything:
                    with open(str(path)+'.txt', 'w', encoding='utf-8') as out:
                        for data in yield_everything(nb):
                            out.write(data.decode()+'\n')
                signatures[path.name] = notary.compute_signature(nb)
            except:
                print('failed to load '+path.name)
                raise
                

with (dir / 'results.json').open('w', encoding='utf-8') as file:
    json.dump(signatures, file)
