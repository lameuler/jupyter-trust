from pathlib import Path
from argparse import ArgumentParser
from nbformat import read
from nbformat.sign import NotebookNotary

parser = ArgumentParser()
parser.add_argument('dir', default='test/.tmp/trust', nargs='?')

args = parser.parse_args()

dir = Path(args.dir)

notary = NotebookNotary(data_dir=str(dir), db_file=str(dir / 'python.db'))

samples = Path('test/samples')

with (samples / 'sample-0.ipynb').open() as file:
    nb0 = read(file, as_version=4)
    
with (samples / 'sample-1.ipynb').open() as file:
    nb1 = read(file, as_version=4)

assert notary.check_signature(nb0) == True
notary.unsign(nb0)

assert notary.check_signature(nb1) == False
notary.sign(nb1)