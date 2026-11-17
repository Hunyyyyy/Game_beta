"""Appends the dagger clips of the assassin to src/data/anims.json (text append, the file is hand-formatted). Safe to rerun: it replaces its own clips.
   python tools/gen-assassin-anims.py"""
import json, math, re, io, sys

PATH = 'E:/Game_beta/src/data/anims.json'
R = lambda v: int(round(v))


def fr(bob=0, lean=0, legR=(0, 0), legL=(0, 0), armR=(0, 0), armL=(0, 0), t1=None, t2=None, **fx):
    o = {"bob": bob, "lean": lean, "legR": {"a": legR[0], "lift": legR[1]}, "legL": {"a": legL[0], "lift": legL[1]},
         "armR": {"a": armR[0], "b": armR[1]}, "armL": {"a": armL[0], "b": armL[1]}}
    if t1 is not None: o["tool"] = dict({"on": True, "a": t1[0], "kind": "dagger"}, **({"pose": t1[1]} if len(t1) > 1 else {}))
    if t2 is not None: o["tool2"] = dict({"on": True, "a": t2[0], "kind": "dagger"}, **({"pose": t2[1]} if len(t2) > 1 else {}))
    o.update(fx)
    return o


clips = {}

# --- idle: daggers sheathed at the small of the back (crossed), low and light on the feet
clips["dagger_idle"] = (3, True, None, False, [
    fr(b, 1, (12, 0), (-12, 0), (-6, 30), (-8, 26), (180, "hip"), (180, "hip2")) for b in (1, 1, 2, 2)])

# --- walk: the sneaking step, hands near the belt, knees bent
walk = []
for i in range(6):
    p = math.radians(i * 60); s = math.sin(p); c = math.cos(p)
    walk.append(fr(1 + (0 if abs(s) < .5 else 0), 3, (R(30 * s), max(0, R(2 * c))), (R(-30 * s), max(0, R(-2 * c))), (-6, 30), (-8, 26), (180, "hip"), (180, "hip2")))
clips["dagger_walk"] = (9, True, None, True, walk)

# --- guard: both daggers drawn, reverse grip, crouched, blades laid back along the forearms
guard = []
for i, (bb, sw) in enumerate([(2, 0), (2, 2), (3, 3), (2, 2)]):
    guard.append(fr(bb, 4, (28, 0), (-30, 0), (62 + sw, 50), (50 - sw, 56), (265, ), (255, )))
clips["dagger_guard"] = (6, True, None, False, guard)

# --- run (charge): the ninja run: body 35 degrees over, arms swept back with the blades trailing, long light strides, hardly any bounce
run = []
for i in range(6):
    p = math.radians(i * 60); s = math.sin(p); c = math.cos(p)
    run.append(fr(-1 if abs(s) < .5 else 0, 9, (R(58 * s), max(0, R(4 * c))), (R(-58 * s), max(0, R(-4 * c))),
                  (-74 + R(6 * s), 18), (-68 - R(6 * s), 22), (252, ), (246, )))
clips["dagger_run"] = (14, True, None, True, run)

# --- combo: smooth. Keyposes below, every step eased through a middle frame, and it starts and ends exactly on the guard pose so the swing does not jump in or out.
def lerp(x, y, t): return x + (y - x) * t


def mix(f1, f2, t):
    o = {}
    for k, v in f1.items():
        w = f2[k]
        if isinstance(v, dict) and k in ('legR', 'legL', 'armR', 'armL'): o[k] = {kk: R(lerp(v[kk], w[kk], t)) for kk in v}
        elif isinstance(v, dict):  # a blade turning more than 150 degrees goes the short way round (through "down"), not through "up"
            y = w['a'] - 360 if w['a'] - v['a'] > 150 else w['a']
            o[k] = dict(v, a=R(lerp(v['a'], y, t)))
        elif isinstance(v, (int, float)): o[k] = R(lerp(v, w, t))
    return o


READY = fr(2, 4, (28, 0), (-30, 0), (62, 50), (50, 56), (265, ), (255, ))
KEYS = [
    READY,
    fr(1, 5, (26, 0), (-30, 0), (132, 22), (50, 56), (232, ), (255, )),                       # 1st blow wind-up: right hand high, by the head
    fr(0, 9, (36, 0), (-30, 0), (66, 14), (50, 56), (74, ), (255, )),                         # 1st blow: right cuts DOWN and across, from the shoulder to the hip
    fr(1, 6, (34, 0), (-30, 0), (34, 20), (6, 44), (52, ), (276, )),                          # right through low, left hand swings back and low
    fr(0, 9, (38, 0), (-32, 0), (30, 24), (128, 8), (52, ), (142, )),                         # 2nd blow: left rips UP from the hip, blade rising forward
    fr(1, 5, (30, 0), (-30, 0), (-10, 58), (-12, 58), (250, ), (250, )),                      # both drawn back
    fr(0, 11, (44, 0), (-32, 0), (92, 5), (86, 5), (96, ), (90, )),                           # the stab, both forward
    READY,
]
combo = []
for i in range(len(KEYS) - 1):
    combo.append(KEYS[i]); combo.append(mix(KEYS[i], KEYS[i + 1], 0.5))
combo.append(KEYS[-1])
clips["dagger_combo"] = (18, False, 4, False, combo)                                          # a blow lands on each of the three: frame 4 (right cut), 8 (left cut), 12 (the stab)
HITS = {"dagger_combo": [8, 12]}                                                              # the later blows (battle.ts: swing.more)

# --- dash: a flat, fast glide: body low and long, legs trailing, blades back, going faint while it lasts. No jump.
dash = [
    fr(0, 12, (-22, 0), (-34, 0), (-84, 6), (-78, 8), (262, ), (256, ), fade=0.35, ghost={"dx": 6, "n": 2, "a": 0.25}),
    fr(0, 12, (-30, 0), (-26, 0), (-86, 4), (-80, 6), (264, ), (258, ), fade=0.3, ghost={"dx": 7, "n": 2, "a": 0.25}),
]
clips["dagger_dash"] = (16, True, None, False, dash)

# --- dodge: lean back and low, a quick slip aside, leaving an after-image
dodge = [
    fr(3, -7, (24, 0), (-34, 0), (-30, 40), (-40, 36), (250, ), (246, ), ghost={"dx": -5, "n": 2, "a": 0.5}),
    fr(5, -10, (14, 0), (-40, 2), (-50, 30), (-56, 28), (252, ), (250, ), ghost={"dx": -8, "n": 3, "a": 0.55}),
]
clips["dagger_dodge"] = (8, False, None, False, dodge)

# --- assassinate: crouch behind the mark, lunge low, drive the blades straight in (hit = 2); no after-image
stab = [
    fr(4, 5, (30, 0), (-32, 0), (-30, 40), (-30, 44), (250, ), (250, )),                      # 0 crouch, blades back
    fr(3, 12, (54, 0), (-34, 0), (80, 20), (70, 24), (100, ), (92, )),                        # 1 the lunge
    fr(3, 14, (58, 0), (-34, 0), (92, 4), (84, 6), (96, ), (90, )),                           # 2 both blades in, at the back of the mark
    fr(3, 14, (58, 0), (-34, 0), (94, 2), (86, 4), (98, ), (92, )),                           # 3 held
    fr(2, 7, (36, 0), (-30, 0), (30, 40), (24, 44), (230, ), (230, )),                        # 4 drawn out
    fr(2, 5, (28, 0), (-28, 0), (62, 50), (50, 56), (265, ), (255, )),                        # 5 ready again
]
clips["dagger_stab"] = (14, False, 2, False, stab)


# --- vanish: sink low, grow faint, then crumble to smoke (hide, retreat or death)
vanish = [
    fr(3, 4, (28, 0), (-30, 0), (60, 60), (52, 62), (265, ), (255, ), fade=0.85),
    fr(5, 5, (30, 0), (-30, 0), (66, 64), (56, 66), (268, ), (258, ), fade=0.6),
    fr(7, 6, (30, 0), (-30, 0), (70, 66), (60, 68), (270, ), (260, ), fade=0.4),
    fr(8, 6, (30, 0), (-30, 0), (70, 66), (60, 68), (270, ), (260, ), fade=0.3, smoke=0.3),
    fr(8, 6, (30, 0), (-30, 0), (70, 66), (60, 68), (270, ), (260, ), fade=0.25, smoke=0.6),
    fr(8, 6, (30, 0), (-30, 0), (70, 66), (60, 68), (270, ), (260, ), fade=0.12, smoke=0.9),
]
clips["dagger_vanish"] = (8, False, None, False, vanish)


# --- leap: over a low fence. Crouch, spring, tuck at the top, land running.
TUCK = dict(legR=(70, 12), legL=(55, 12), armR=(40, 80), armL=(35, 84))              # knees to the chest, arms wrapped round them
leap = [
    fr(3, 7, (30, 0), (-34, 0), (-40, 30), (-36, 32), (258, ), (252, )),                  # 0 crouch
    fr(-5, 8, rot=45, t1=(250, ), t2=(246, ), **TUCK),                                    # 1 spring and begin to turn
    fr(-10, 8, rot=115, t1=(250, ), t2=(246, ), **TUCK),                                  # 2
    fr(-13, 8, rot=185, t1=(250, ), t2=(246, ), **TUCK),                                  # 3 upside down over the fence
    fr(-13, 8, rot=255, t1=(250, ), t2=(246, ), **TUCK),                                  # 4
    fr(-9, 8, rot=325, t1=(250, ), t2=(246, ), **TUCK),                                   # 5
    fr(-2, 8, (40, 4), (-30, 6), (-30, 40), (-28, 42), (256, ), (250, )),                 # 6 opening out to land
    fr(3, 7, (30, 0), (-34, 0), (-40, 30), (-36, 32), (258, ), (252, )),                  # 7 land in a crouch
]
clips["dagger_leap"] = (11, False, None, False, leap)

# --- climb: up a high wall. Upright, hands reaching up in turn, knees driving.
climb = []
for i in range(4):
    up = i % 2 == 0
    climb.append(fr(0 if up else 1, 1, (30, 7) if up else (-10, 0), (-10, 0) if up else (30, 7),
                    (150, 10) if up else (122, 18), (124, 18) if up else (150, 10), (100, ), (96, )))
clips["dagger_climb"] = (8, True, None, False, climb)


def emit():
    out = []
    for k, (fps, loop, hit, gait, frames) in clips.items():
        head = '  "%s": { "fps": %d, "loop": %s%s%s%s, "frames": [\n' % (k, fps, 'true' if loop else 'false', '' if hit is None else ', "hit": %d' % hit, ', "hits": %s' % json.dumps(HITS[k]) if k in HITS else '', ', "gait": true' if gait else '')
        out.append(head + ',\n'.join('    ' + json.dumps(f, separators=(',', ':')) for f in frames) + '\n  ] }')
    return ',\n'.join(out)


with open(PATH, 'r', encoding='utf-8', newline='') as fh:
    raw = fh.read()
crlf = '\r\n' in raw
txt = raw.replace('\r\n', '\n')
# drop earlier copies of our clips (rerun), then append
for k in clips:
    txt = re.sub(r',\n  "%s": \{ "fps".*?\n  \] \}' % k, '', txt, flags=re.S)
body = txt.rstrip()
assert body.endswith('}')
body = body[:-1].rstrip()
txt = body + ',\n' + emit() + '\n}\n'
json.loads(txt)  # must stay valid
with open(PATH, 'w', encoding='utf-8', newline='') as fh:
    fh.write(txt.replace('\n', '\r\n') if crlf else txt)
print('ok', len(clips), 'clips')
