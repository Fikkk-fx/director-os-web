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
    return fs.readFileSync(filePath, 'utf-8').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
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
  const modeEnforcement = \`
=================================
⚠️ FATAL SYSTEM MANDATE: RAW UNRESTRICTED MODE & CINEMATIC ENGLISH ⚠️
There is NO word count or character limit. You are free to write expansive, deeply choreographed scenes with extreme cinematic detail.
DO NOT summarize or compress your logic. Output the most spectacular, complex physics vectors and prose possible.

- ABSOLUTE LANGUAGE LAW: The ENTIRE prompt, all descriptions, and structural tags MUST BE WRITTEN IN HIGH-END CINEMATIC ENGLISH. NEVER translate camera movements or prose into Indonesian, even if the user prompts you in Indonesian. ONLY the spoken dialogue inside the quotes may remain in the native language.
- HARDCORE TERMINOLOGY: Use extreme Hollywood terminology for camera moves (e.g., [RAPID PUSH-IN], [THE ORBIT RELAY], [PEDESTAL CORKSCREW DOWN], [TACTICAL BREECH CAM]). Do NOT use basic terms like "Kamera beralih" or "Lensa menyorot".
- ANTI-FREEZE WORD BAN: NEVER use "freeze", "static", "still", "motionless", "hold pose" in [PROSE]. Replace with "settles into pose, continuous micro-tremors fingers hair fabric breathing". The Living Statue Rule: even stopped characters must have 3 micro-movements (breathing, hair drift, finger twitch).
- ANTI-ZOOM-ZOOM BAN: NEVER zoom in then zoom out in ONE clip. Use mono-directional camera (only zoom IN or only zoom OUT or orbit). If you need both close-up and wide, use [HARD CUT: ANGLE SHIFT] between them.
- ANTI-SLOWMO LAW (ACTION DENSITY PADDING): AI video engines default to SLOW-MOTION if a time block (e.g., 3s) only contains a short action like a punch (which takes 0.5s in real life). To force REAL-TIME speed, you MUST pad the remaining 2.5 seconds with continuous secondary physics (e.g., staggering, wiping blood, heavy breathing, dropping items). Never leave empty time!
- SCREEN-RELATIVE COMPASS: Use screen-left/screen-right/toward camera/away from camera instead of North/South/East/West in [COMPASS RULE]. AI engines work in 2D screen space.
=================================\`;

  return \`You are THE DIRECTOR O.S. V19.1.

\${coreEngine}

\${dynamicInjection}

\${modeEnforcement}
USER RENDER ENGINE SELECTION: \${engine.toUpperCase()}
FORMAT YOUR RESPONSE EXACTLY AS FOLLOWS:
Do not converse. Output ONLY the prompt blueprint.

CRITICAL RULE (ANTI-SLOP & ANTI-HALLUCINATION):
You MUST format your response using this EXACT rigid template below. Do NOT deviate, do not add poetic words like 'essence' or 'tradition', and DO NOT skip any tags. 

🚨 GLOBAL TRANSLATION LOCK 🚨
ALL DESCRIPTIONS, PROSE, AND KINETIC CAMERA MOVEMENTS MUST BE WRITTEN IN ENGLISH. 
JANGAN PERNAH menggunakan Bahasa Indonesia untuk mendeskripsikan adegan! Jika Anda menerjemahkan "[RAPID PUSH-IN]" menjadi "Kamera bergerak cepat", sistem akan error. SATU-SATUNYA teks yang boleh menggunakan Bahasa Indonesia adalah DIALOG di dalam tanda kutip.

FIRST TOKEN PRE-FILL MANDATE:
Your ENTIRE response MUST begin immediately with the exact characters: "[SYS-LOG: RNG INITIATIVE:". Do NOT put conversational text or code blocks before it.

[SYS-LOG: RNG INITIATIVE: Roll 1d20 = [Random Number] - [Brief Scene/Weather Lock]]

\\\`\\\`\\\`text
[PROSE]: 
[0s-3s]: [CAPITALIZED CAMERA MOVE, e.g. TACTICAL PUSH-IN] [Write kinetic action strictly in ENGLISH. NO INDONESIAN. e.g. The camera rapidly tracks...].
[3s-6s]: [CAPITALIZED CAMERA MOVE] [Write next action in ENGLISH ONLY].
[6s-10s]: [CAPITALIZED CAMERA MOVE] [Write climax in ENGLISH]. [Kondisi Emosi/Aksi], speaking fluent [Language]: "[Dialogue]".
[SPATIAL DEPTH ENGINE]: LAYER 1: [Background] | LAYER 2: [Midground] | LAYER 3: [Subject] | LAYER 4: [Foreground]
[GLOBAL LOCK]: [Wardrobe, Location, Time]
[RENDER & ACTING LOCK]: [Aesthetic, Lighting, Acting style]
[CAMERA & PHYSICS LOCK]: [Camera movement, Lens]
[PHYSICS VECTORS]: Gaze: [..] | Body: [..] | Compass: [..] | Momentum: [..] | Light: [..] | Prox: [..] | Relativity: [..]
\\\`\\\`\\\`

CRITICAL MULTI-CLIP RULE: EVERY individual clip prompt MUST begin with its own [SYS-LOG: RNG INITIATIVE] block OUTSIDE the markdown code block. This is mandatory for both single-clip and multi-clip outputs. A clip without [SYS-LOG] is INVALID.
DO NOT print any audit tables or character counts at the end of your response. The web UI will handle the audit automatically.
\`;
}
`;

fs.writeFileSync('src/system-prompt.js', jsOutput);
console.log('Dynamic system-prompt.js has been generated successfully!');
