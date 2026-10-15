# 使い方: python3 make_gift.py コード  → ゲームに埋め込むハッシュを表示
import sys,hashlib,unicodedata
c=unicodedata.normalize('NFKC',sys.argv[1]).strip().upper().replace(' ','').replace('-','')
print(c, hashlib.sha256(('meister-tower:'+c).encode()).hexdigest())
