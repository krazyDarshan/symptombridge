"""Build a separate combined index; never overwrite the original benchmark index."""
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'frontend/public/data'
base = json.loads((DATA / 'materia-medica-index.json').read_text(encoding='utf-8'))
extra = json.loads((ROOT / 'outputs/chronic_diseases_dataset/chronic-diseases-index.json').read_text(encoding='utf-8'))
combined = copy.deepcopy(base)
combined['datasetVersion'] = '2.0.0-preview'
combined['sources'] = {'materia-medica-pura': {'title': 'Materia Medica Pura', 'pageCount': 1183}, **extra['sources']}
# Only explicit equivalents; salts/preparations are never merged by fuzzy name.
equivalents = {'Aurum metallicum': 'PREP0009', 'Conium maculatum': 'PREP0027',
              'Digitalis purpurea': 'PREP0029', 'Sarsaparilla officinalis': 'PREP0064',
              'Sulphur': 'PREP0071'}
by_id = {p['id']: p for p in combined['preparations']}
merged = []
for incoming in extra['preparations']:
    target = by_id.get(equivalents.get(incoming['name']))
    if target is None:
        matches = [p for p in combined['preparations'] if p['name'].casefold() == incoming['name'].casefold()]
        target = matches[0] if len(matches) == 1 else None
    if target is None:
        combined['preparations'].append(copy.deepcopy(incoming))
    else:
        target['symptoms'].extend(incoming['symptoms'])
        target['aliases'] = list(dict.fromkeys([*target.get('aliases', []), incoming['name']]))
        merged.append({'sourceRemedy': incoming['name'], 'targetId': target['id'], 'targetName': target['name']})
(DATA / 'combined-remedy-index.json').write_text(json.dumps(combined, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
summary = {'version': combined['datasetVersion'], 'preparations': len(combined['preparations']),
           'sourceRows': sum(len(p['symptoms']) for p in combined['preparations']), 'merges': merged}
(ROOT / 'outputs/chronic_diseases_dataset/integration-summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
print(json.dumps(summary, indent=2))
