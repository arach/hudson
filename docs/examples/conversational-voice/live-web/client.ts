import { connectGPTLiveOverWebRTC, makeDispatcher } from '../web-host-example';
import { startWebRTCEventHost, type WebRTCEventHost, type ConversationSession, type RTCPeerConnectionLike } from '@hudsonkit/ai/conversation';
const status = document.querySelector('#status')!;
const log = document.querySelector('#events')!;
const audio = document.querySelector('audio')!;
const start = document.querySelector<HTMLButtonElement>('#start')!;
const stop = document.querySelector<HTMLButtonElement>('#stop')!;
const interrupt = document.querySelector<HTMLButtonElement>('#interrupt')!;
const resume = document.querySelector<HTMLButtonElement>('#resume')!;
let host: WebRTCEventHost | undefined;
let session: ConversationSession | undefined;
let microphone: MediaStream | undefined;
let deadline: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
let opening = false;
function record(message: string) { log.textContent += `${new Date().toISOString()} ${message}\n`; }
async function cleanup() {
  generation++;
  clearTimeout(deadline);
  audio.muted = true;
  microphone?.getTracks().forEach(track=>track.stop()); microphone=undefined;
  const oldHost=host;host=undefined; const oldSession=session;session=undefined;
  try { if(oldHost) await oldHost.stop(); else await oldSession?.close(); }
  catch {record('Close failed; local tracks and playback were stopped.');}
  audio.srcObject=null;
  start.disabled=opening;stop.disabled=true;interrupt.disabled=true;resume.disabled=true;
  record('Local cleanup complete.');
}
start.onclick=async()=>{
  if(opening || host) return;
  opening=true;start.disabled=true;stop.disabled=false;const run=++generation;
  try {
    const setup=await (await fetch('/status')).json();
    if(!setup.ready) throw new Error(setup.message);
    const captured=await navigator.mediaDevices.getUserMedia({audio:true});
    if(run!==generation){captured.getTracks().forEach(t=>t.stop());return;}
    microphone=captured;
    deadline=setTimeout(()=>void cleanup(),90000);
    const connected=await connectGPTLiveOverWebRTC({config:setup.config,sessionRouteUrl:'/session',microphone,
      createPeerConnection:()=>new RTCPeerConnection() as unknown as RTCPeerConnectionLike,
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
  } catch(error) { status.textContent=error instanceof Error?error.message:'Connection failed';await cleanup(); }
  finally {opening=false;if(!host)start.disabled=false;}
};
stop.onclick=()=>void cleanup();interrupt.onclick=()=>host?.bargeIn();resume.onclick=()=>host?.resumeRemoteAudio();
window.addEventListener('pagehide',()=>{audio.muted=true;microphone?.getTracks().forEach(t=>t.stop());void host?.stop();});
fetch('/status').then(r=>r.json()).then(s=>{status.textContent=s.message;start.disabled=!s.ready;}).catch(()=>{status.textContent='Local server unavailable.';});
