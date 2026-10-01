import test from 'node:test';
import assert from 'node:assert/strict';
import { loadClientConfig } from '../auth-config.js';
const id='123-published.apps.googleusercontent.com';
const empty={getItem:()=>null};
test('fresh Android browser reads published Client ID without any local setup',async()=>{
 assert.deepEqual(await loadClientConfig(async()=>({config:{googleClientId:' '+id+' '}}),empty),{clientId:id,source:'published'});
});
test('published Client ID wins over an old PC-only setting',async()=>{
 assert.equal((await loadClientConfig(async()=>({config:{googleClientId:id}}),{getItem:()=> '999-old.apps.googleusercontent.com'})).clientId,id);
});
test('browser-local settings are identified as local, not shared with Android',async()=>{
 assert.equal((await loadClientConfig(async()=>({config:{googleClientId:''}}),{getItem:()=>id})).source,'local');
 assert.equal((await loadClientConfig(async()=>({config:{googleClientId:''}}),empty)).source,'missing');
});
test('bad or unavailable published config is not silently replaced with a stale project',async()=>{
 for(const load of [async()=>{throw Error('network');},async()=>({config:{googleClientId:'invalid'}})]){
 assert.deepEqual(await loadClientConfig(load,{getItem:()=>id}),{clientId:'',source:'error'});
 }
});
