import { connectGPTLiveOverWebRTC, makeDispatcher } from '../web-host-example';
import { startWebRTCEventHost, type WebRTCEventHost, type ConversationSession, type RTCPeerConnectionLike } from '@hudsonkit/ai/conversation';
const status = document.querySelector('#status')!;
const log = document.querySelector('#events')!;
const audio = document.querySelector('audio')!;
const start = document.querySelector<HTMLButtonElement>('#start')!;
const stop = document.querySelector<HTMLButtonElement>('#stop')!;
const interrupt = document.querySelector<HTMLButtonElement>('#interrupt')!;
const resume = document.querySelector<HTMLButtonElement>('#resume')!;
const micSelect = document.querySelector<HTMLSelectElement>('#microphone')!;
const refreshMics = document.querySelector<HTMLButtonElement>('#refresh-microphones')!;
const micStatus = document.querySelector<HTMLElement>('#microphone-status')!;
let peer: RTCPeerConnection | undefined;
let selectingMicrophone = false;
let host: WebRTCEventHost | undefined;
let session: ConversationSession | undefined;
let microphone: MediaStream | undefined;
let deadline: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
let opening = false;
function record(message: string) { log.textContent += `${new Date().toISOString()} ${message}\n`; }
function captureMicrophone() {
  record(`Microphone capture requested: ${micSelect.selectedOptions[0]?.textContent ?? 'System default'}.`);
  return navigator.mediaDevices.getUserMedia({ audio: micSelect.value
    ? { deviceId: { exact: micSelect.value } } : true });
}
async function listMicrophones() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const selected = micSelect.value;
  const inputs = devices.filter(device => device.kind === 'audioinput');
  micSelect.replaceChildren(new Option('System default', ''));
  inputs.forEach((device, index) => micSelect.add(new Option(device.label || `Microphone ${index + 1}`, device.deviceId)));
  if (selected && !inputs.some(device => device.deviceId === selected)) {
    micSelect.add(new Option('Selected microphone unavailable — choose another', selected));
  }
  micSelect.value = selected;
  record(`Microphone list refreshed: ${inputs.length} inputs.`);
}
function describeMicrophone(stream: MediaStream) {
  const track = stream.getAudioTracks()[0];
  micStatus.textContent = `Using: ${track?.label || 'System default microphone'}`;
  record(`Microphone acquired: ${track?.label || 'System default'}.`);
  track?.addEventListener('ended', () => {
    if (microphone !== stream) return;
    micStatus.textContent = 'Microphone disconnected. Choose another microphone or reconnect.';
    record('Active microphone ended.');
  });
}
refreshMics.onclick = async () => {
  if (opening || selectingMicrophone) return;
  selectingMicrophone = true; refreshMics.disabled = true;
  let probe: MediaStream | undefined;
  try {
    // Permission exposes device labels. Never publish this temporary stream.
    if (!microphone) probe = await navigator.mediaDevices.getUserMedia({ audio: true });
    await listMicrophones();
    if (!microphone) micStatus.textContent = 'Choose a microphone, then connect.';
  } catch { micStatus.textContent = 'Microphone access failed. Check browser microphone permission and try again.'; }
  finally { probe?.getTracks().forEach(track => track.stop()); selectingMicrophone = false; refreshMics.disabled = false; }
};
micSelect.onchange = async () => {
  if (!microphone || !peer || opening || selectingMicrophone) return;
  const run = generation;
  const old = microphone;
  const sender = peer.getSenders().find(item => item.track?.kind === 'audio');
  selectingMicrophone = true; micSelect.disabled = true;
  let replacement: MediaStream | undefined;
  try {
    if (!sender) throw new Error('No audio sender');
    replacement = await captureMicrophone();
    if (run !== generation) return;
    const track = replacement.getAudioTracks()[0];
    if (!track) throw new Error('No microphone track');
    await sender.replaceTrack(track);
    if (run !== generation) return;
    microphone = replacement; replacement = undefined;
    old.getTracks().forEach(item => item.stop());
    describeMicrophone(microphone);
    record('Microphone switched within the existing session.');
  } catch {
    if (run === generation) {
      const actual = old.getAudioTracks()[0]?.getSettings().deviceId;
      micSelect.value = actual && Array.from(micSelect.options).some(option => option.value === actual) ? actual : '';
      micStatus.textContent = `Could not switch; still using ${old.getAudioTracks()[0]?.label || 'the previous microphone'}.`;
      record('Microphone switch failed; previous input preserved.');
    }
  } finally { replacement?.getTracks().forEach(track => track.stop()); selectingMicrophone = false; micSelect.disabled = opening; }
};
navigator.mediaDevices.addEventListener('devicechange', () => { void listMicrophones().catch(() => record('Microphone list refresh failed.')); });
void listMicrophones().catch(() => record('Microphone enumeration unavailable.'));
async function cleanup() {
  generation++;
  clearTimeout(deadline);
  audio.muted = true;
  microphone?.getTracks().forEach(track=>track.stop()); microphone=undefined;
  const oldHost=host;host=undefined; const oldSession=session;session=undefined;
  try { if(oldHost) await oldHost.stop(); else await oldSession?.close(); }
  catch {record('Close failed; local tracks and playback were stopped.');}
  audio.srcObject=null; peer=undefined; micSelect.disabled=opening;
  status.textContent='Stopped. Choose a microphone and connect when ready.';
  start.disabled=opening;stop.disabled=true;interrupt.disabled=true;resume.disabled=true;
  record('Local cleanup complete.');
}
start.onclick=async()=>{
  if(opening || host || selectingMicrophone) return;
  opening=true;micSelect.disabled=true;refreshMics.disabled=true;start.disabled=true;stop.disabled=false;const run=++generation;
  try {
    const setup=await (await fetch('/status')).json();
    if(!setup.ready) throw new Error(setup.message);
    const captured=await captureMicrophone();
    if(run!==generation){captured.getTracks().forEach(t=>t.stop());return;}
    microphone=captured;describeMicrophone(captured);void listMicrophones().catch(()=>record('Microphone list refresh failed.'));
    deadline=setTimeout(()=>void cleanup(),90000);
    const connected=await connectGPTLiveOverWebRTC({config:setup.config,sessionRouteUrl:'/session',microphone,
      createPeerConnection:()=>{peer=new RTCPeerConnection();return peer as unknown as RTCPeerConnectionLike;},
      attachRemoteTrack:track=>{if(run!==generation)return;audio.srcObject=new MediaStream([track as MediaStreamTrack]);audio.muted=false;void audio.play().catch(()=>record('Click the audio Play control to allow playback.'));}});
    if(run!==generation){await connected.close();return;}
    session=connected;
    const dispatcher=makeDispatcher();
    const instrumented={...dispatcher,dispatch:async(...args:Parameters<typeof dispatcher.dispatch>)=>{
      record(`Local tool requested: ${args[0].name}`);
      const result=await dispatcher.dispatch(...args);record(result.output.ok ? 'Local tool succeeded; result ready for delivery.' : 'Local tool rejected or failed.');return result;
    }};
    host=startWebRTCEventHost({session,dispatcher:instrumented,muteRemoteAudio:()=>{audio.muted=true;record('Remote playback muted.');},unmuteRemoteAudio:()=>{audio.muted=false;},
      onUserTranscript:delta=>record(`You: ${delta}`),onAssistantTranscript:delta=>record(`Assistant: ${delta}`),onError:()=>{record('Session failed.');void cleanup();}});
    interrupt.disabled=false;resume.disabled=false;status.textContent='Connected. Speak now. Session stops after 90 seconds.';record('Connected with real microphone and remote track.');
  } catch(error) { await cleanup();status.textContent=error instanceof Error?error.message:'Connection failed'; }
  finally {opening=false;micSelect.disabled=false;refreshMics.disabled=false;if(!host)start.disabled=false;}
};
stop.onclick=()=>void cleanup();interrupt.onclick=()=>host?.bargeIn();resume.onclick=()=>host?.resumeRemoteAudio();
window.addEventListener('pagehide',()=>{audio.muted=true;microphone?.getTracks().forEach(t=>t.stop());void host?.stop();});
fetch('/status').then(r=>r.json()).then(s=>{status.textContent=s.message;start.disabled=!s.ready;}).catch(()=>{status.textContent='Local server unavailable.';});
