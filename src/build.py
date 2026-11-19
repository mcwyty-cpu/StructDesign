"""Rebuild index.html from the source modules:  python src/build.py"""
import os
here = os.path.dirname(os.path.abspath(__file__))
mods = ['engine.js', 'demo.js', 'sheets.js', 'sections.js', 'calc.js', 'xlsx.js', 'view3d.js', 'app.js']
js = '\n'.join(open(os.path.join(here, f), encoding='utf-8').read() for f in mods)
t = open(os.path.join(here, 'template.html'), encoding='utf-8').read()
head = ('<link rel="manifest" href="manifest.webmanifest" crossorigin="use-credentials">'
        '<link rel="icon" href="icon-192.png"><link rel="apple-touch-icon" href="icon-192.png">')
open(os.path.join(here, '..', 'index.html'), 'w', encoding='utf-8').write(t.replace('//ENGINE', js).replace('<!--PWA-->', head))
print('index.html rebuilt')
