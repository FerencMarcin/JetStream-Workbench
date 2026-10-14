# Sample keys

Sample keys to use **local only** (!):
* public: `UBUJS7JGSZZPG7C5R7LJLCJKPK6GMXFPE47WUVO7X2CYBQ4GE4WI6ZMZ`
* private: `SUABPA7E2PQVEQDWNZRK74TUWVOC77DJAS7BXMLMP3A2G6NBQM4JQKFPNY`

# Generate new keys

1. Install `nkeys`: 
```
go install github.com/nats-io/nkeys/nk@latest
```
2. Use to create new keys:
```
nk -gen user -pubout
```