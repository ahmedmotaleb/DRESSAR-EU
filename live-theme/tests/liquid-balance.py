import os, re, sys

ROOT = "/home/user/DRESSAR-EU/live-theme"

# Real Shopify Liquid block tags (open ... {% endX %})
BLOCK = {"if","unless","case","for","tablerow","capture","form","paginate",
         "comment","raw","schema","stylesheet","javascript","style"}
# Tags that live INSIDE a block and open nothing
INNER = {"else","elsif","when","break","continue","increment","decrement",
         "assign","echo","render","include","section","sections","layout","cycle",
         "liquid","doc","enddoc","content_for","form_url","paginate_by"}
# Zones whose inner text is NOT Liquid-parsed for tag purposes
LITERAL = {"raw","comment","schema","stylesheet","javascript"}

TAGRE = re.compile(r"\{%-?\s*(.*?)\s*-?%\}", re.S)

def tokens(src):
    """Yield (tagname, offset) in document order, descending into {% liquid %} bodies,
    and skipping the interior of literal zones."""
    i = 0
    skip_until = None
    while True:
        m = TAGRE.search(src, i)
        if not m: return
        inner = m.group(1)
        name = inner.split()[0] if inner.split() else ""
        if skip_until:
            if name == skip_until:
                yield (name, m.start())
                skip_until = None
            i = m.end()
            continue
        if name == "liquid":
            yield (name, m.start())
            in_lit = None
            for raw_line in inner[len("liquid"):].splitlines():
                line = raw_line.strip()
                if not line or line.startswith("#"): continue
                w = line.split()[0]
                if in_lit:
                    if w == "end" + in_lit:
                        yield (w, m.start()); in_lit = None
                    continue
                yield (w, m.start())
                if w in ("comment", "raw"):
                    in_lit = w
        else:
            yield (name, m.start())
            if name in LITERAL:
                skip_until = "end" + name
        i = m.end()

def check(path):
    src = open(path, encoding="utf-8").read()
    rel = os.path.relpath(path, ROOT)
    stack, errs = [], []
    for name, pos in tokens(src):
        if name.startswith("end") and name[3:] in BLOCK:
            want = name[3:]
            if not stack:
                errs.append("line %d: stray {%% %s %%}" % (src[:pos].count("\n")+1, name))
            elif stack[-1][0] != want:
                errs.append("line %d: {%% %s %%} closes {%% %s %%} opened line %d"
                            % (src[:pos].count("\n")+1, name, stack[-1][0],
                               src[:stack[-1][1]].count("\n")+1))
                stack.pop()
            else:
                stack.pop()
        elif name in BLOCK:
            stack.append((name, pos))
        elif name in INNER or name.startswith("end"):
            pass
        else:
            errs.append("line %d: unknown tag {%% %s %%}" % (src[:pos].count("\n")+1, name))
    for name, pos in stack:
        errs.append("line %d: unclosed {%% %s %%}" % (src[:pos].count("\n")+1, name))
    return errs

total = 0
for d in ("sections","snippets"):
    p = os.path.join(ROOT, d)
    for n in sorted(os.listdir(p)):
        if not n.endswith(".liquid"): continue
        errs = check(os.path.join(p, n))
        if errs:
            total += len(errs)
            print("%s/%s" % (d, n))
            for e in errs: print("   ", e)
print("---")
print("balance errors:", total)
