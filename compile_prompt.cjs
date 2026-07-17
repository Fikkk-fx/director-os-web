const fs = require('fs');
const path = require('path');

const configDir = 'C:\\Users\\apilp\\.gemini\\config';

const coreFiles = [
  path.join(configDir, 'AGENTS.md'),
  path.join(configDir, 'director_os_master_workflow.txt'),
  path.join(configDir, 'skills', '00_MASTER_OS.md'),
  path.join(configDir, 'skills', 'cinemaskill', 'SKILL.md'),
  path.join(configDir, 'skills', 'promptskill', 'SKILL.md'),
  path.join(configDir, 'skills', 'storyskill', 'SKILL.md'),
  path.join(configDir, 'skills', 'writerskill', 'SKILL.md'),
];

const dynamicSkills = {
  fashionskill: path.join(configDir, 'skills', 'fashionskill', 'SKILL.md'),
  indoskill: path.join(configDir, 'skills', 'indoskill', 'SKILL.md'),
  japanskill: path.join(configDir, 'skills', 'japanskill', 'SKILL.md'),
  ugcskill: path.join(configDir, 'skills', 'ugcskill', 'SKILL.md'),
  audioskill: path.join(configDir, 'skills', 'audioskill', 'SKILL.md'),
  videoorchestra: path.join(configDir, 'skills', 'videoorchestra', 'SKILL.md'),
  charsheet: path.join(configDir, 'skills', 'charsheet', 'SKILL.md'),
  envsheet: path.join(configDir, 'skills', 'envsheet', 'SKILL.md'),
  propsheet: path.join(configDir, 'skills', 'propsheet', 'SKILL.md'),
};

function readSafe(filePath) {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8').replace(/`/g, '\\`').replace(/\$/g, '\\$');
  }
  return '';
}

let jsOutput = `// src/system-prompt.js
// AUTO-GENERATED: DYNAMIC AUTEUR ROUTER (RAG-STYLE)

const coreEngine = \`
${coreFiles.map(f => readSafe(f)).join('\\n\\n')}
\`;

const skills = {
`;

for (const [key, filePath] of Object.entries(dynamicSkills)) {
  jsOutput += `  ${key}: \`${readSafe(filePath)}\`,\n`;
}

jsOutput += `};

export function getSystemPrompt(engine, userMessage, mode = 'mini') {
  const msg = userMessage.toLowerCase();
  let dynamicInjection = "";

  // 1. CULTURAL AESTHETICS ROUTER
  if (msg.includes('indo') || msg.includes('jawa') || msg.includes('jakarta') || msg.includes('kebaya') || msg.includes('tawuran') || msg.includes('silat')) {
    dynamicInjection += "\\n\\n--- INDOSKILL ---\\n" + skills.indoskill;
  }
  if (msg.includes('jepang') || msg.includes('japan') || msg.includes('yakuza') || msg.includes('samurai') || msg.includes('anime')) {
    dynamicInjection += "\\n\\n--- JAPANSKILL ---\\n" + skills.japanskill;
  }
  if (msg.includes('fashion') || msg.includes('baju') || msg.includes('model') || msg.includes('balenciaga') || msg.includes('mugler')) {
    dynamicInjection += "\\n\\n--- FASHIONSKILL ---\\n" + skills.fashionskill;
  }

  // 2. PLATFORM / FORMAT ROUTER
  if (msg.includes('ugc') || msg.includes('tiktok') || msg.includes('reels') || msg.includes('selfie') || msg.includes('vlog')) {
    dynamicInjection += "\\n\\n--- UGCSKILL ---\\n" + skills.ugcskill;
  }

  // 3. AUDIO & DIALOGUE ROUTER
  if (msg.includes('suara') || msg.includes('audio') || msg.includes('ngomong') || msg.includes('dialog') || msg.includes('bicara')) {
    dynamicInjection += "\\n\\n--- AUDIOSKILL ---\\n" + skills.audioskill;
  }



  // 5. MULTI-CLIP ORCHESTRATION ROUTER (Time/Duration)
  const isMultiClip = msg.includes('menit') || msg.includes('orchestra') || msg.match(/\\b(1[1-9]|[2-9][0-9]|100)\\s*detik\\b/);
  if (isMultiClip) {
    dynamicInjection += "\\n\\n--- MULTI-CLIP BLUEPRINTS ---\\n" + skills.videoorchestra + "\\n" + skills.charsheet + "\\n" + skills.envsheet + "\\n" + skills.propsheet;
  }

  // MODE-BASED CHARACTER LIMIT ENFORCEMENT
  const charLimit = mode === 'mini' ? 2000 : 3000;
  const modeName = mode === 'mini' ? 'MINI' : 'STANDARD';
  const modeEnforcement = \`
=================================
⚠️ FATAL SYSTEM MANDATE: ABSOLUTE CHARACTER LIMIT (MODE: \${modeName}) ⚠️
The user has selected \${modeName} mode.
\${mode === 'mini' ? 'TARGET LENGTH: 1800 - 1900 CHARACTERS MAXIMUM.\\nFATAL ERROR TRIGGER: IF YOUR PROMPT EXCEEDS 2000 CHARACTERS, THE RENDER ENGINE WILL CRASH. YOU MUST BE EXTREMELY SURGICAL.' : 'TARGET LENGTH: Under 3000 characters.'}

CRITICAL CLARIFICATION: This character limit applies STRICTLY AND ONLY to the individual Phase 2 Video Clip Prompt (the text from [SYS-LOG] down to the final [PHYSICS VECTORS] tag). This OVERRIDES any other rules.

This is a HARD, UNFORGIVING LIMIT for the video prompt. You MUST NOT exceed \${charLimit} characters for the clip prompt.
DO NOT sacrifice quality, cinematic physics, or protocol compliance to meet this limit. Instead, use SURGICAL COMPRESSION:
\${mode === 'mini' ? \`🚨 STRICT WORD COUNT LIMITER ACTIVE:
1. [PROSE]: MAX 35 WORDS (Max 2 kalimat).
2. [GLOBAL LOCK]: MAX 25 WORDS.
3. [RENDER & ACTING LOCK]: MAX 25 WORDS.
4. [CAMERA & PHYSICS LOCK]: MAX 25 WORDS.
5. [PHYSICS VECTORS]: MAX 3-5 words per vector.\` : ''}
- Remove filler words and redundant adjectives (e.g. use "Window screen-right, futon center, door screen-left" instead of verbose descriptions).
- Omit conversational explanations inside the prompt blocks.
- Use precise, surgical vocabulary instead of verbose descriptions (e.g. "zero vignette/borders" instead of "zero vignette, zero borders").
- EXTREME ABBREVIATION for Language Locks: Use "(fluent Arabic)" instead of "(fluent native Arabic, strictly NO English)".
- EXTREME ABBREVIATION for Wardrobe: Use "Man 40s Arabic white thawb barefoot" instead of "Man 40s Middle Eastern man olive skin pristine white silk thawb barefoot".
- ANTI-FREEZE WORD BAN: NEVER use "freeze", "static", "still", "motionless", "hold pose" in [PROSE]. Replace with "settles into pose, continuous micro-tremors fingers hair fabric breathing". The Living Statue Rule: even stopped characters must have 3 micro-movements (breathing, hair drift, finger twitch).
- ANTI-ZOOM-ZOOM BAN: NEVER zoom in then zoom out in ONE clip. Use mono-directional camera (only zoom IN or only zoom OUT or orbit). If you need both close-up and wide, use [HARD CUT: ANGLE SHIFT] between them.
- SCREEN-RELATIVE COMPASS: Use screen-left/screen-right/toward camera/away from camera instead of North/South/East/West in [COMPASS RULE]. AI engines work in 2D screen space.
- Prioritize the most impactful visual beats.

=================================\`;

  return \`You are THE DIRECTOR O.S. V19.1.

\${coreEngine}

\${dynamicInjection}

\${modeEnforcement}
USER RENDER ENGINE SELECTION: \${engine.toUpperCase()}
FORMAT YOUR RESPONSE AS FOLLOWS:
Do not converse. Output only the prompt blueprint.
Include a brief explanation block at the top, followed by the EXACT prompt blocks inside markdown code blocks.
CRITICAL MULTI-CLIP RULE: If the output contains multiple clips (Phase 2 Video Orchestration), EVERY individual clip prompt MUST begin with its own [SYS-LOG: RNG INITIATIVE] block BEFORE [PROSE]. This is mandatory for both single-clip and multi-clip outputs. A clip without [SYS-LOG] is INVALID.
DO NOT print any audit tables or character counts at the end of your response. The web UI will handle the audit and character counting automatically.
\`;
}
`;

fs.writeFileSync('src/system-prompt.js', jsOutput);
console.log('Dynamic system-prompt.js has been generated successfully!');
