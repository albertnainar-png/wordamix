/* Native (Capacitor/Android) glue. Does nothing in a normal browser. */
(function(){
'use strict';
const C=window.Capacitor;if(!C||!C.isNativePlatform||!C.isNativePlatform())return;
const App=C.Plugins&&C.Plugins.App;if(!App)return;
const G=window.__wordamix,$=id=>document.getElementById(id);
const open=id=>$(id).classList.contains('on');
App.addListener('backButton',()=>{
  if(open('wordsov'))return G.closeWords();   // close the word list first
  if(window.__mp&&window.__mp.back())return;   // multiplayer screens handle their own back
  if(open('resov'))return G.home();           // round complete -> home
  if(open('pauseov'))return G.resume();       // paused -> resume
  if(G.state==='PLAYING')return G.pause();    // playing -> pause (never exits mid-round)
  const scr=document.querySelector('.screen.on');
  if(scr&&scr.id==='game')return G.home();    // countdown -> home
  if(scr&&scr.id!=='home')return G.show('home'); // how-to / settings -> home
  App.exitApp();                              // home -> leave app
});
App.addListener('pause',()=>{if(G.state==='PLAYING')G.pause();}); // app sent to background
})();
