'use strict';

(function(global){
  var TOKEN_KEY = 'lms_smansev_token';

  function apiUrl(){
    var cfg = global.LMS_CONFIG || {};
    var url = String(cfg.API_URL || '').trim();
    if(!url || url.indexOf('PASTE_GOOGLE_APPS_SCRIPT') !== -1){
      throw new Error('API_URL belum diatur. Edit frontend/assets/js/config.js dan isi URL /exec Google Apps Script.');
    }
    return url;
  }

  function getToken(){
    try { return localStorage.getItem(TOKEN_KEY) || ''; }
    catch(e) { return ''; }
  }

  function setToken(token){
    try {
      if(token) localStorage.setItem(TOKEN_KEY, String(token));
    } catch(e) {}
  }

  function clearSession(){
    try { localStorage.removeItem(TOKEN_KEY); } catch(e) {}
  }

  function hasToken(){
    return !!getToken();
  }

  function call(action, args){
    var payload = {
      apiVersion: 1,
      action: String(action || ''),
      args: Array.isArray(args) ? args : [],
      token: getToken()
    };

    /*
     * text/plain sengaja digunakan agar request tetap sederhana dan tidak
     * menambahkan header otorisasi/custom header yang dapat memicu preflight.
     * Token tetap ditandatangani dan divalidasi di backend.
     */
    return fetch(apiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      cache: 'no-store'
    })
    .then(function(response){
      if(!response.ok){
        throw new Error('HTTP ' + response.status + ' saat menghubungi backend.');
      }
      return response.text();
    })
    .then(function(text){
      var result;
      try {
        result = JSON.parse(text);
      } catch(e) {
        throw new Error('Respons backend bukan JSON. Pastikan URL yang dipakai adalah URL deployment /exec dan akses Web App sudah benar.');
      }

      if(result && result.sessionToken){
        setToken(result.sessionToken);
      }
      if(result && result.clearSession){
        clearSession();
      }
      return result;
    });
  }

  global.LMSApi = {
    call: call,
    getToken: getToken,
    hasToken: hasToken,
    clearSession: clearSession
  };
})(window);
