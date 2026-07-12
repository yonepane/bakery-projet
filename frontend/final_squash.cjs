const fs = require('fs');

let d = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');
d = d.replace(/use_fedcm={true}/g, '');
d = d.replace(/} catch \(err: unknown\) {/g, '} catch (err: any) {');
d = d.replace(/} catch \(error: unknown\) {/g, '} catch (error: any) {');
d = d.replace(/} catch \(e: unknown\) {/g, '} catch (e: any) {');
fs.writeFileSync('src/components/Dashboard.tsx', d);

let t = fs.readFileSync('src/components/dashboard/types.ts', 'utf8');
t = t.replace(/fetchData: \(\) => void;/, 'fetchData: (tab?: string) => void;');
t = t.replace(/setLang: \(l: 'en' \| 'fr' \| 'ar'\) => void;/, 'setLang: (l: any) => void;');
t = t.replace(/setEditingCustomer: \(s: \{ name: string; contact_info: string; \}\) => void;/, 'setEditingCustomer: React.Dispatch<React.SetStateAction<any>>;');
t = t.replace(/handleDeleteShiftLog: \(id: string\) => void;/, 'handleDeleteShiftLog: (id: number) => Promise<void>;');
fs.writeFileSync('src/components/dashboard/types.ts', t);

console.log("Squashed.");
