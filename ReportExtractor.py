#!/usr/bin/env python
# ## Extract SAS Report from Viya transfer object
#
# SAS Report objects for transfer can be compressed - They start with **TRUE###**.
#
# Here is python code reading from *transport.json* and extracting all xml of reports to current folder.
#
# To get to xml, one has to decode string using base64, and then decompress it with zlib.
import argparse
import json
import base64
import zlib
import os

parser = argparse.ArgumentParser()
parser.add_argument("file", type=str, help="")
args = parser.parse_args()

def getXMLfromContent(content):
    compress = False
    if content.startswith("TRUE###"):
        real_content = content[7:]
        compress = True
    elif content.startswith("FALSE###"):
        real_content = content[8:]
    else:
        real_content = content
    byte_decoded = base64.b64decode(real_content)
    if compress:
        byte_decompressed = zlib.decompress(byte_decoded)
    else:
        byte_decompressed = byte_decoded
    object_json = json.loads(byte_decompressed.decode("utf8"))
    return object_json["transferableContent"]["content"]


with open(args.file, encoding="utf-8") as jfile:
    transport = json.load(jfile)

path=os.path.basename(jfile.name)+ "_Reports";
print("Extracting the following reports into folder: " + path );
try:
    if not os.path.exists(path):
	    os.mkdir(path)
except OSError:
    print ("Creation of the directory %s failed" % path )
   

for k in transport["transferDetails"]:
    if k["transferObject"]["summary"]["type"] == "report":
        rname = k["transferObject"]["summary"]["name"]
        xml = getXMLfromContent(k["transferObject"]["content"])
        print("\t{}".format(rname))
 #       print(xml)
        with open(path+"\{}.xml".format(rname), "w", encoding="utf-8") as ofile:
            ofile.write(xml)
