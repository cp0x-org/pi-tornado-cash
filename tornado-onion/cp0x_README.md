# Generate addresses

## install mkp224o

```
sudo apt install git build-essential autoconf libsodium-dev

git clone https://github.com/cathugger/mkp224o.git
cd mkp224o
./autogen.sh
./configure
make -j$(nproc)
```

## generate addresses with beginning with `neko`

```
./mkp224o -d neko_keys neko
```

## copy keys from `neko_keys/<domain>` to `tor_data/service1`

## run

```
docker compose up -d
```

