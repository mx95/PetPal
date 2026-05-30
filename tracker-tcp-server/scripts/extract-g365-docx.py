import html
import os
import re
import shutil
import zipfile

DOCX = r"c:\Users\skapn\OneDrive\Desktop\Projects\365GPS 2G and 4G GPS tracker communication protocol 20240702.docx"
OUT = r"c:\Users\skapn\OneDrive\Desktop\Projects\PetPal\tracker-tcp-server\docs\g365-docx-extract"

shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(os.path.join(OUT, "media"), exist_ok=True)

with zipfile.ZipFile(DOCX) as z:
    for name in z.namelist():
        if name.startswith("word/media/"):
            data = z.read(name)
            fn = os.path.basename(name)
            with open(os.path.join(OUT, "media", fn), "wb") as f:
                f.write(data)

    xml = z.read("word/document.xml").decode("utf-8")
    text = re.sub(r"</w:p>", "\n", xml)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    with open(os.path.join(OUT, "document.txt"), "w", encoding="utf-8") as f:
        f.write(text)

    refs = re.findall(r'r:embed="([^"]+)"', xml)
    rels = z.read("word/_rels/document.xml.rels").decode("utf-8")
    id_to_target = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
    lines = []
    for i, rid in enumerate(refs):
        target = id_to_target.get(rid, "")
        if "media" in target:
            lines.append(f"{i + 1}: {os.path.basename(target)}")
    with open(os.path.join(OUT, "images-index.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

media_dir = os.path.join(OUT, "media")
print("media files:", len(os.listdir(media_dir)))
print("image refs:", len(lines))
for line in lines:
    print(line)
