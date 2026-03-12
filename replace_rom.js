import fs from 'fs';

const file = 'src/constants/emulators.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/'"%ROM%"'/g, "'%ROM%'"); // Fixes defaultArgs in TS
content = content.replace(/-L "%CORE%" "%ROM%"/g, "-L \\\"%CORE%\\\" %ROM%"); // Replaces RetroArch if needed
fs.writeFileSync(file, content);

const file2 = 'server/routes/emuRoutes.ts';
let content2 = fs.readFileSync(file2, 'utf8');
content2 = content2.replace(/'"%ROM%"'/g, "'%ROM%'"); 
fs.writeFileSync(file2, content2);
