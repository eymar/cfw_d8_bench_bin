// include: shell.js
// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module != 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)


// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = Object.assign({}, Module);

var arguments_ = [];
var thisProgram = './this.program';
var quit_ = (status, toThrow) => {
  throw toThrow;
};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

// Attempt to auto-detect the environment
var ENVIRONMENT_IS_WEB = typeof window == 'object';
var ENVIRONMENT_IS_WORKER = typeof importScripts == 'function';
// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
var ENVIRONMENT_IS_NODE = typeof process == 'object' && typeof process.versions == 'object' && typeof process.versions.node == 'string';
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (Module['ENVIRONMENT']) {
  throw new Error('Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -sENVIRONMENT=web or -sENVIRONMENT=node)');
}

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var read_,
    readAsync,
    readBinary;

if (false) {
  if (typeof process == 'undefined' || !process.release || process.release.name !== 'node') throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  var nodeVersion = process.versions.node;
  var numericVersion = nodeVersion.split('.').slice(0, 3);
  numericVersion = (numericVersion[0] * 10000) + (numericVersion[1] * 100) + (numericVersion[2].split('-')[0] * 1);
  var minVersion = 160000;
  if (numericVersion < 160000) {
    throw new Error('This emscripten-generated code requires node v16.0.0 (detected v' + nodeVersion + ')');
  }

  // `require()` is no-op in an ESM module, use `createRequire()` to construct
  // the require()` function.  This is only necessary for multi-environment
  // builds, `-sENVIRONMENT=node` emits a static import declaration instead.
  // TODO: Swap all `require()`'s with `import()`'s?
  // These modules will usually be used on Node.js. Load them eagerly to avoid
  // the complexity of lazy-loading.
  var fs = require('fs');
  var nodePath = require('path');

  if (ENVIRONMENT_IS_WORKER) {
    scriptDirectory = nodePath.dirname(scriptDirectory) + '/';
  } else {
    scriptDirectory = __dirname + '/';
  }

// include: node_shell_read.js
read_ = (filename, binary) => {
  // We need to re-wrap `file://` strings to URLs. Normalizing isn't
  // necessary in that case, the path should already be absolute.
  filename = isFileURI(filename) ? new URL(filename) : nodePath.normalize(filename);
  return fs.readFileSync(filename, binary ? undefined : 'utf8');
};

readBinary = (filename) => {
  var ret = read_(filename, true);
  if (!ret.buffer) {
    ret = new Uint8Array(ret);
  }
  assert(ret.buffer);
  return ret;
};

readAsync = (filename, onload, onerror, binary = true) => {
  // See the comment in the `read_` function.
  filename = isFileURI(filename) ? new URL(filename) : nodePath.normalize(filename);
  fs.readFile(filename, binary ? undefined : 'utf8', (err, data) => {
    if (err) onerror(err);
    else onload(binary ? data.buffer : data);
  });
};
// end include: node_shell_read.js
  if (!Module['thisProgram'] && process.argv.length > 1) {
    thisProgram = process.argv[1].replace(/\\/g, '/');
  }

  arguments_ = process.argv.slice(2);

  if (typeof module != 'undefined') {
    module['exports'] = Module;
  }

  process.on('uncaughtException', (ex) => {
    // suppress ExitStatus exceptions from showing an error
    if (ex !== 'unwind' && !(ex instanceof ExitStatus) && !(ex.context instanceof ExitStatus)) {
      throw ex;
    }
  });

  quit_ = (status, toThrow) => {
    process.exitCode = status;
    throw toThrow;
  };

  Module['inspect'] = () => '[Emscripten Module object]';

} else
if (ENVIRONMENT_IS_SHELL) {

  if ((typeof process == 'object' && typeof require === 'function') || typeof window == 'object' || typeof importScripts == 'function') throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  if (typeof read != 'undefined') {
    read_ = read;
  }

  readBinary = (f) => {
    if (typeof readbuffer == 'function') {
      return new Uint8Array(readbuffer(f));
    }
    let data = read(f, 'binary');
    assert(typeof data == 'object');
    return data;
  };

  readAsync = (f, onload, onerror) => {
    setTimeout(() => onload(readBinary(f)));
  };

  if (typeof clearTimeout == 'undefined') {
    globalThis.clearTimeout = (id) => {};
  }

  if (typeof setTimeout == 'undefined') {
    // spidermonkey lacks setTimeout but we use it above in readAsync.
    globalThis.setTimeout = (f) => (typeof f == 'function') ? f() : abort();
  }

  if (typeof scriptArgs != 'undefined') {
    arguments_ = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    arguments_ = arguments;
  }

  if (typeof quit == 'function') {
    quit_ = (status, toThrow) => {
      // Unlike node which has process.exitCode, d8 has no such mechanism. So we
      // have no way to set the exit code and then let the program exit with
      // that code when it naturally stops running (say, when all setTimeouts
      // have completed). For that reason, we must call `quit` - the only way to
      // set the exit code - but quit also halts immediately.  To increase
      // consistency with node (and the web) we schedule the actual quit call
      // using a setTimeout to give the current stack and any exception handlers
      // a chance to run.  This enables features such as addOnPostRun (which
      // expected to be able to run code after main returns).
      setTimeout(() => {
        if (!(toThrow instanceof ExitStatus)) {
          let toLog = toThrow;
          if (toThrow && typeof toThrow == 'object' && toThrow.stack) {
            toLog = [toThrow, toThrow.stack];
          }
          err(`exiting due to exception: ${toLog}`);
        }
        quit(status);
      });
      throw toThrow;
    };
  }

  if (typeof print != 'undefined') {
    // Prefer to use print/printErr where they exist, as they usually work better.
    if (typeof console == 'undefined') console = /** @type{!Console} */({});
    console.log = /** @type{!function(this:Console, ...*): undefined} */ (print);
    console.warn = console.error = /** @type{!function(this:Console, ...*): undefined} */ (typeof printErr != 'undefined' ? printErr : print);
  }

} else

// Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) { // Check worker, not web, since window could be polyfilled
    scriptDirectory = self.location.href;
  } else if (typeof document != 'undefined' && document.currentScript) { // web
    scriptDirectory = document.currentScript.src;
  }
  // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
  // otherwise, slice off the final part of the url to find the script directory.
  // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
  // and scriptDirectory will correctly be replaced with an empty string.
  // If scriptDirectory contains a query (starting with ?) or a fragment (starting with #),
  // they are removed because they could contain a slash.
  if (scriptDirectory.indexOf('blob:') !== 0) {
    scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf('/')+1);
  } else {
    scriptDirectory = '';
  }

  if (!(typeof window == 'object' || typeof importScripts == 'function')) throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  // Differentiate the Web Worker from the Node Worker case, as reading must
  // be done differently.
  {
// include: web_or_worker_shell_read.js
read_ = (url) => {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  }

  if (ENVIRONMENT_IS_WORKER) {
    readBinary = (url) => {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.responseType = 'arraybuffer';
      xhr.send(null);
      return new Uint8Array(/** @type{!ArrayBuffer} */(xhr.response));
    };
  }

  readAsync = (url, onload, onerror) => {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  }

// end include: web_or_worker_shell_read.js
  }
} else
{
  throw new Error('environment detection error');
}

var out = Module['print'] || console.log.bind(console);
var err = Module['printErr'] || console.error.bind(console);

// Merge back in the overrides
Object.assign(Module, moduleOverrides);
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = null;
checkIncomingModuleAPI();

// Emit code to handle expected values on the Module object. This applies Module.x
// to the proper local x. This has two benefits: first, we only emit it if it is
// expected to arrive, and second, by using a local everywhere else that can be
// minified.

if (Module['arguments']) arguments_ = Module['arguments'];legacyModuleProp('arguments', 'arguments_');

if (Module['thisProgram']) thisProgram = Module['thisProgram'];legacyModuleProp('thisProgram', 'thisProgram');

if (Module['quit']) quit_ = Module['quit'];legacyModuleProp('quit', 'quit_');

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message
// Assertions on removed incoming Module JS APIs.
assert(typeof Module['memoryInitializerPrefixURL'] == 'undefined', 'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['pthreadMainPrefixURL'] == 'undefined', 'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['cdInitializerPrefixURL'] == 'undefined', 'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['filePackagePrefixURL'] == 'undefined', 'Module.filePackagePrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['read'] == 'undefined', 'Module.read option was removed (modify read_ in JS)');
assert(typeof Module['readAsync'] == 'undefined', 'Module.readAsync option was removed (modify readAsync in JS)');
assert(typeof Module['readBinary'] == 'undefined', 'Module.readBinary option was removed (modify readBinary in JS)');
assert(typeof Module['setWindowTitle'] == 'undefined', 'Module.setWindowTitle option was removed (modify emscripten_set_window_title in JS)');
assert(typeof Module['TOTAL_MEMORY'] == 'undefined', 'Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY');
legacyModuleProp('asm', 'wasmExports');
legacyModuleProp('read', 'read_');
legacyModuleProp('readAsync', 'readAsync');
legacyModuleProp('readBinary', 'readBinary');
legacyModuleProp('setWindowTitle', 'setWindowTitle');
var IDBFS = 'IDBFS is no longer included by default; build with -lidbfs.js';
var PROXYFS = 'PROXYFS is no longer included by default; build with -lproxyfs.js';
var WORKERFS = 'WORKERFS is no longer included by default; build with -lworkerfs.js';
var FETCHFS = 'FETCHFS is no longer included by default; build with -lfetchfs.js';
var ICASEFS = 'ICASEFS is no longer included by default; build with -licasefs.js';
var JSFILEFS = 'JSFILEFS is no longer included by default; build with -ljsfilefs.js';
var OPFS = 'OPFS is no longer included by default; build with -lopfs.js';

var NODEFS = 'NODEFS is no longer included by default; build with -lnodefs.js';

assert(!ENVIRONMENT_IS_SHELL, "shell environment detected but not enabled at build time.  Add 'shell' to `-sENVIRONMENT` to enable.");


// end include: shell.js
// include: preamble.js
// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

var wasmBinary; 
if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];legacyModuleProp('wasmBinary', 'wasmBinary');

if (typeof WebAssembly != 'object') {
  abort('no native wasm support detected');
}

// Wasm globals

var wasmMemory;

//========================================
// Runtime essentials
//========================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS;

// In STRICT mode, we only define assert() when ASSERTIONS is set.  i.e. we
// don't define it at all in release modes.  This matches the behaviour of
// MINIMAL_RUNTIME.
// TODO(sbc): Make this the default even without STRICT enabled.
/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed' + (text ? ': ' + text : ''));
  }
}

// We used to include malloc/free by default in the past. Show a helpful error in
// builds with assertions.

// Memory management

var HEAP,
/** @type {!Int8Array} */
  HEAP8,
/** @type {!Uint8Array} */
  HEAPU8,
/** @type {!Int16Array} */
  HEAP16,
/** @type {!Uint16Array} */
  HEAPU16,
/** @type {!Int32Array} */
  HEAP32,
/** @type {!Uint32Array} */
  HEAPU32,
/** @type {!Float32Array} */
  HEAPF32,
/** @type {!Float64Array} */
  HEAPF64;

function updateMemoryViews() {
  var b = wasmMemory.buffer;
  Module['HEAP8'] = HEAP8 = new Int8Array(b);
  Module['HEAP16'] = HEAP16 = new Int16Array(b);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(b);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(b);
  Module['HEAP32'] = HEAP32 = new Int32Array(b);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(b);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(b);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(b);
}

assert(!Module['STACK_SIZE'], 'STACK_SIZE can no longer be set at runtime.  Use -sSTACK_SIZE at link time')

assert(typeof Int32Array != 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray != undefined && Int32Array.prototype.set != undefined,
       'JS engine does not provide full typed array support');

// If memory is defined in wasm, the user can't provide it, or set INITIAL_MEMORY
assert(!Module['wasmMemory'], 'Use of `wasmMemory` detected.  Use -sIMPORTED_MEMORY to define wasmMemory externally');
assert(!Module['INITIAL_MEMORY'], 'Detected runtime INITIAL_MEMORY setting.  Use -sIMPORTED_MEMORY to define wasmMemory dynamically');

// include: runtime_stack_check.js
// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  var max = _emscripten_stack_get_end();
  assert((max & 3) == 0);
  // If the stack ends at address zero we write our cookies 4 bytes into the
  // stack.  This prevents interference with SAFE_HEAP and ASAN which also
  // monitor writes to address zero.
  if (max == 0) {
    max += 4;
  }
  // The stack grow downwards towards _emscripten_stack_get_end.
  // We write cookies to the final two words in the stack and detect if they are
  // ever overwritten.
  HEAPU32[((max)>>2)] = 0x02135467;
  HEAPU32[(((max)+(4))>>2)] = 0x89BACDFE;
  // Also test the global address 0 for integrity.
  HEAPU32[((0)>>2)] = 1668509029;
}

function checkStackCookie() {
  if (ABORT) return;
  var max = _emscripten_stack_get_end();
  // See writeStackCookie().
  if (max == 0) {
    max += 4;
  }
  var cookie1 = HEAPU32[((max)>>2)];
  var cookie2 = HEAPU32[(((max)+(4))>>2)];
  if (cookie1 != 0x02135467 || cookie2 != 0x89BACDFE) {
    abort(`Stack overflow! Stack cookie has been overwritten at ${ptrToString(max)}, expected hex dwords 0x89BACDFE and 0x2135467, but received ${ptrToString(cookie2)} ${ptrToString(cookie1)}`);
  }
  // Also test the global address 0 for integrity.
  if (HEAPU32[((0)>>2)] != 0x63736d65 /* 'emsc' */) {
    abort('Runtime error: The application has corrupted its heap memory area (address zero)!');
  }
}
// end include: runtime_stack_check.js
// include: runtime_assertions.js
// Endianness check
(function() {
  var h16 = new Int16Array(1);
  var h8 = new Int8Array(h16.buffer);
  h16[0] = 0x6373;
  if (h8[0] !== 0x73 || h8[1] !== 0x63) throw 'Runtime error: expected the system to be little-endian! (Run with -sSUPPORT_BIG_ENDIAN to bypass)';
})();

// end include: runtime_assertions.js
var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;

function preRun() {
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function initRuntime() {
  assert(!runtimeInitialized);
  runtimeInitialized = true;

  checkStackCookie();

  
if (!Module["noFSInit"] && !FS.init.initialized)
  FS.init();
FS.ignorePermissions = false;

TTY.init();
  callRuntimeCallbacks(__ATINIT__);
}

function postRun() {
  checkStackCookie();

  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnExit(cb) {
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// include: runtime_math.js
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/fround

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/clz32

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc

assert(Math.imul, 'This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.fround, 'This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.clz32, 'This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.trunc, 'This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
// end include: runtime_math.js
// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
}

function addRunDependency(id) {
  runDependencies++;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval != 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(() => {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err('still waiting on run dependencies:');
          }
          err(`dependency: ${dep}`);
        }
        if (shown) {
          err('(end of list)');
        }
      }, 10000);
    }
  } else {
    err('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

/** @param {string|number=} what */
function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  what = 'Aborted(' + what + ')';
  // TODO(sbc): Should we remove printing and leave it up to whoever
  // catches the exception?
  err(what);

  ABORT = true;
  EXITSTATUS = 1;

  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  // FIXME This approach does not work in Wasm EH because it currently does not assume
  // all RuntimeErrors are from traps; it decides whether a RuntimeError is from
  // a trap or not based on a hidden field within the object. So at the moment
  // we don't have a way of throwing a wasm trap from JS. TODO Make a JS API that
  // allows this in the wasm spec.

  // Suppress closure compiler warning here. Closure compiler's builtin extern
  // defintion for WebAssembly.RuntimeError claims it takes no arguments even
  // though it can.
  // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure gets fixed.
  /** @suppress {checkTypes} */
  var e = new WebAssembly.RuntimeError(what);

  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e;
}

// include: memoryprofiler.js
// end include: memoryprofiler.js
// include: URIUtils.js
// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

/**
 * Indicates whether filename is a base64 data URI.
 * @noinline
 */
var isDataURI = (filename) => filename.startsWith(dataURIPrefix);

/**
 * Indicates whether filename is delivered via file protocol (as opposed to http/https)
 * @noinline
 */
var isFileURI = (filename) => filename.startsWith('file://');
// end include: URIUtils.js
function createExportWrapper(name) {
  return function() {
    assert(runtimeInitialized, `native function \`${name}\` called before runtime initialization`);
    var f = wasmExports[name];
    assert(f, `exported native function \`${name}\` not found`);
    return f.apply(null, arguments);
  };
}

// include: runtime_exceptions.js
// end include: runtime_exceptions.js
var wasmBinaryFile;
  wasmBinaryFile = 'skiko.wasm';
  if (!isDataURI(wasmBinaryFile)) {
    wasmBinaryFile = locateFile(wasmBinaryFile);
  }

function getBinarySync(file) {
  if (file == wasmBinaryFile && wasmBinary) {
    return new Uint8Array(wasmBinary);
  }
  if (readBinary) {
    return readBinary(file);
  }
  throw "both async and sync fetching of the wasm failed";
}

function getBinaryPromise(binaryFile) {
  // If we don't have the binary yet, try to load it asynchronously.
  // Fetch has some additional restrictions over XHR, like it can't be used on a file:// url.
  // See https://github.com/github/fetch/pull/92#issuecomment-140665932
  // Cordova or Electron apps are typically loaded from a file:// url.
  // So use fetch if it is available and the url is not a file, otherwise fall back to XHR.
  if (!wasmBinary
      && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
    if (typeof fetch == 'function'
      && !isFileURI(binaryFile)
    ) {
      return fetch(binaryFile, { credentials: 'same-origin' }).then((response) => {
        if (!response['ok']) {
          throw "failed to load wasm binary file at '" + binaryFile + "'";
        }
        return response['arrayBuffer']();
      }).catch(() => getBinarySync(binaryFile));
    }
    else if (readAsync) {
      // fetch is not available or url is file => try XHR (readAsync uses XHR internally)
      return new Promise((resolve, reject) => {
        readAsync(binaryFile, (response) => resolve(new Uint8Array(/** @type{!ArrayBuffer} */(response))), reject)
      });
    }
  }

  // Otherwise, getBinarySync should be able to get it synchronously
  return Promise.resolve().then(() => getBinarySync(binaryFile));
}

function instantiateArrayBuffer(binaryFile, imports, receiver) {
  return getBinaryPromise(binaryFile).then((binary) => {
    return WebAssembly.instantiate(binary, imports);
  }).then((instance) => {
    return instance;
  }).then(receiver, (reason) => {
    err(`failed to asynchronously prepare wasm: ${reason}`);

    // Warn on some common problems.
    if (isFileURI(wasmBinaryFile)) {
      err(`warning: Loading from a file URI (${wasmBinaryFile}) is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing`);
    }
    abort(reason);
  });
}

function instantiateAsync(binary, binaryFile, imports, callback) {
  if (!binary &&
      typeof WebAssembly.instantiateStreaming == 'function' &&
      !isDataURI(binaryFile) &&
      // Don't use streaming for file:// delivered objects in a webview, fetch them synchronously.
      !isFileURI(binaryFile) &&
      // Avoid instantiateStreaming() on Node.js environment for now, as while
      // Node.js v18.1.0 implements it, it does not have a full fetch()
      // implementation yet.
      //
      // Reference:
      //   https://github.com/emscripten-core/emscripten/pull/16917
      !ENVIRONMENT_IS_NODE &&
      typeof fetch == 'function') {
    return fetch(binaryFile, { credentials: 'same-origin' }).then((response) => {
      // Suppress closure warning here since the upstream definition for
      // instantiateStreaming only allows Promise<Repsponse> rather than
      // an actual Response.
      // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure is fixed.
      /** @suppress {checkTypes} */
      var result = WebAssembly.instantiateStreaming(response, imports);

      return result.then(
        callback,
        function(reason) {
          // We expect the most common failure cause to be a bad MIME type for the binary,
          // in which case falling back to ArrayBuffer instantiation should work.
          err(`wasm streaming compile failed: ${reason}`);
          err('falling back to ArrayBuffer instantiation');
          return instantiateArrayBuffer(binaryFile, imports, callback);
        });
    });
  }
  return instantiateArrayBuffer(binaryFile, imports, callback);
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
function createWasm() {
  // prepare imports
  var info = {
    'env': wasmImports,
    'wasi_snapshot_preview1': wasmImports,
  };
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module*/
  function receiveInstance(instance, module) {
    wasmExports = instance.exports;

    

    wasmMemory = wasmExports['memory'];
    
    assert(wasmMemory, "memory not found in wasm exports");
    // This assertion doesn't hold when emscripten is run in --post-link
    // mode.
    // TODO(sbc): Read INITIAL_MEMORY out of the wasm file in post-link mode.
    //assert(wasmMemory.buffer.byteLength === 16777216);
    updateMemoryViews();

    wasmTable = wasmExports['__indirect_function_table'];
    
    assert(wasmTable, "table not found in wasm exports");

    addOnInit(wasmExports['__wasm_call_ctors']);

    removeRunDependency('wasm-instantiate');
    return wasmExports;
  }
  // wait for the pthread pool (if any)
  addRunDependency('wasm-instantiate');

  // Prefer streaming instantiation if available.
  // Async compilation can be confusing when an error on the page overwrites Module
  // (for example, if the order of elements is wrong, and the one defining Module is
  // later), so we save Module and check it later.
  var trueModule = Module;
  function receiveInstantiationResult(result) {
    // 'result' is a ResultObject object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    assert(Module === trueModule, 'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?');
    trueModule = null;
    // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
    // When the regression is fixed, can restore the above PTHREADS-enabled path.
    receiveInstance(result['instance']);
  }

  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to
  // run the instantiation parallel to any other async startup actions they are
  // performing.
  // Also pthreads and wasm workers initialize the wasm instance through this
  // path.
  if (Module['instantiateWasm']) {

    try {
      return Module['instantiateWasm'](info, receiveInstance);
    } catch(e) {
      err(`Module.instantiateWasm callback failed with error: ${e}`);
        return false;
    }
  }

  instantiateAsync(wasmBinary, wasmBinaryFile, info, receiveInstantiationResult);
  return {}; // no exports yet; we'll fill them in later
}

// Globals used by JS i64 conversions (see makeSetValue)
var tempDouble;
var tempI64;

// include: runtime_debug.js
function legacyModuleProp(prop, newName, incomming=true) {
  if (!Object.getOwnPropertyDescriptor(Module, prop)) {
    Object.defineProperty(Module, prop, {
      configurable: true,
      get() {
        let extra = incomming ? ' (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)' : '';
        abort(`\`Module.${prop}\` has been replaced by \`${newName}\`` + extra);

      }
    });
  }
}

function ignoredModuleProp(prop) {
  if (Object.getOwnPropertyDescriptor(Module, prop)) {
    abort(`\`Module.${prop}\` was supplied but \`${prop}\` not included in INCOMING_MODULE_JS_API`);
  }
}

// forcing the filesystem exports a few things by default
function isExportedByForceFilesystem(name) {
  return name === 'FS_createPath' ||
         name === 'FS_createDataFile' ||
         name === 'FS_createPreloadedFile' ||
         name === 'FS_unlink' ||
         name === 'addRunDependency' ||
         // The old FS has some functionality that WasmFS lacks.
         name === 'FS_createLazyFile' ||
         name === 'FS_createDevice' ||
         name === 'removeRunDependency';
}

function missingGlobal(sym, msg) {
  if (typeof globalThis !== 'undefined') {
    Object.defineProperty(globalThis, sym, {
      configurable: true,
      get() {
        warnOnce(`\`${sym}\` is not longer defined by emscripten. ${msg}`);
        return undefined;
      }
    });
  }
}

missingGlobal('buffer', 'Please use HEAP8.buffer or wasmMemory.buffer');
missingGlobal('asm', 'Please use wasmExports instead');

function missingLibrarySymbol(sym) {
  if (typeof globalThis !== 'undefined' && !Object.getOwnPropertyDescriptor(globalThis, sym)) {
    Object.defineProperty(globalThis, sym, {
      configurable: true,
      get() {
        // Can't `abort()` here because it would break code that does runtime
        // checks.  e.g. `if (typeof SDL === 'undefined')`.
        var msg = `\`${sym}\` is a library symbol and not included by default; add it to your library.js __deps or to DEFAULT_LIBRARY_FUNCS_TO_INCLUDE on the command line`;
        // DEFAULT_LIBRARY_FUNCS_TO_INCLUDE requires the name as it appears in
        // library.js, which means $name for a JS name with no prefix, or name
        // for a JS name like _name.
        var librarySymbol = sym;
        if (!librarySymbol.startsWith('_')) {
          librarySymbol = '$' + sym;
        }
        msg += ` (e.g. -sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE='${librarySymbol}')`;
        if (isExportedByForceFilesystem(sym)) {
          msg += '. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you';
        }
        warnOnce(msg);
        return undefined;
      }
    });
  }
  // Any symbol that is not included from the JS libary is also (by definition)
  // not exported on the Module object.
  unexportedRuntimeSymbol(sym);
}

function unexportedRuntimeSymbol(sym) {
  if (!Object.getOwnPropertyDescriptor(Module, sym)) {
    Object.defineProperty(Module, sym, {
      configurable: true,
      get() {
        var msg = `'${sym}' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the Emscripten FAQ)`;
        if (isExportedByForceFilesystem(sym)) {
          msg += '. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you';
        }
        abort(msg);
      }
    });
  }
}

// Used by XXXXX_DEBUG settings to output debug messages.
function dbg(text) {
  // TODO(sbc): Make this configurable somehow.  Its not always convenient for
  // logging to show up as warnings.
  console.warn.apply(console, arguments);
}
// end include: runtime_debug.js
// === Body ===

var ASM_CONSTS = {
  1952040: ($0) => { _releaseCallback($0) },  
 1952065: ($0) => { return _callCallback($0).value ? 1 : 0; },  
 1952109: ($0) => { return _callCallback($0).value; },  
 1952145: ($0) => { return _callCallback($0).value; },  
 1952181: ($0) => { return _callCallback($0).value; },  
 1952217: ($0) => { _callCallback($0); }
};


// end include: preamble.js

  /** @constructor */
  function ExitStatus(status) {
      this.name = 'ExitStatus';
      this.message = `Program terminated with exit(${status})`;
      this.status = status;
    }

  var callRuntimeCallbacks = (callbacks) => {
      while (callbacks.length > 0) {
        // Pass the module as the first argument.
        callbacks.shift()(Module);
      }
    };

  
    /**
     * @param {number} ptr
     * @param {string} type
     */
  function getValue(ptr, type = 'i8') {
    if (type.endsWith('*')) type = '*';
    switch (type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': abort('to do getValue(i64) use WASM_BIGINT');
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      case '*': return HEAPU32[((ptr)>>2)];
      default: abort(`invalid type for getValue: ${type}`);
    }
  }

  var noExitRuntime = Module['noExitRuntime'] || true;

  var ptrToString = (ptr) => {
      assert(typeof ptr === 'number');
      // With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
      ptr >>>= 0;
      return '0x' + ptr.toString(16).padStart(8, '0');
    };

  
    /**
     * @param {number} ptr
     * @param {number} value
     * @param {string} type
     */
  function setValue(ptr, value, type = 'i8') {
    if (type.endsWith('*')) type = '*';
    switch (type) {
      case 'i1': HEAP8[((ptr)>>0)] = value; break;
      case 'i8': HEAP8[((ptr)>>0)] = value; break;
      case 'i16': HEAP16[((ptr)>>1)] = value; break;
      case 'i32': HEAP32[((ptr)>>2)] = value; break;
      case 'i64': abort('to do setValue(i64) use WASM_BIGINT');
      case 'float': HEAPF32[((ptr)>>2)] = value; break;
      case 'double': HEAPF64[((ptr)>>3)] = value; break;
      case '*': HEAPU32[((ptr)>>2)] = value; break;
      default: abort(`invalid type for setValue: ${type}`);
    }
  }

  var warnOnce = (text) => {
      if (!warnOnce.shown) warnOnce.shown = {};
      if (!warnOnce.shown[text]) {
        warnOnce.shown[text] = 1;
        if (ENVIRONMENT_IS_NODE) text = 'warning: ' + text;
        err(text);
      }
    };

  var setErrNo = (value) => {
      HEAP32[((___errno_location())>>2)] = value;
      return value;
    };
  
  var PATH = {
  isAbs:(path) => path.charAt(0) === '/',
  splitPath:(filename) => {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1);
      },
  normalizeArray:(parts, allowAboveRoot) => {
        // if the path tries to go above the root, `up` ends up > 0
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
          var last = parts[i];
          if (last === '.') {
            parts.splice(i, 1);
          } else if (last === '..') {
            parts.splice(i, 1);
            up++;
          } else if (up) {
            parts.splice(i, 1);
            up--;
          }
        }
        // if the path is allowed to go above the root, restore leading ..s
        if (allowAboveRoot) {
          for (; up; up--) {
            parts.unshift('..');
          }
        }
        return parts;
      },
  normalize:(path) => {
        var isAbsolute = PATH.isAbs(path),
            trailingSlash = path.substr(-1) === '/';
        // Normalize the path
        path = PATH.normalizeArray(path.split('/').filter((p) => !!p), !isAbsolute).join('/');
        if (!path && !isAbsolute) {
          path = '.';
        }
        if (path && trailingSlash) {
          path += '/';
        }
        return (isAbsolute ? '/' : '') + path;
      },
  dirname:(path) => {
        var result = PATH.splitPath(path),
            root = result[0],
            dir = result[1];
        if (!root && !dir) {
          // No dirname whatsoever
          return '.';
        }
        if (dir) {
          // It has a dirname, strip trailing slash
          dir = dir.substr(0, dir.length - 1);
        }
        return root + dir;
      },
  basename:(path) => {
        // EMSCRIPTEN return '/'' for '/', not an empty string
        if (path === '/') return '/';
        path = PATH.normalize(path);
        path = path.replace(/\/$/, "");
        var lastSlash = path.lastIndexOf('/');
        if (lastSlash === -1) return path;
        return path.substr(lastSlash+1);
      },
  join:function() {
        var paths = Array.prototype.slice.call(arguments);
        return PATH.normalize(paths.join('/'));
      },
  join2:(l, r) => PATH.normalize(l + '/' + r),
  };
  
  var initRandomFill = () => {
      if (typeof crypto == 'object' && typeof crypto['getRandomValues'] == 'function') {
        // for modern web browsers
        return (view) => crypto.getRandomValues(view);
      } else
      if (false) {
        // for nodejs with or without crypto support included
        try {
          var crypto_module = require('crypto');
          var randomFillSync = crypto_module['randomFillSync'];
          if (randomFillSync) {
            // nodejs with LTS crypto support
            return (view) => crypto_module['randomFillSync'](view);
          }
          // very old nodejs with the original crypto API
          var randomBytes = crypto_module['randomBytes'];
          return (view) => (
            view.set(randomBytes(view.byteLength)),
            // Return the original view to match modern native implementations.
            view
          );
        } catch (e) {
          // nodejs doesn't have crypto support
        }
      }
      // we couldn't find a proper implementation, as Math.random() is not suitable for /dev/random, see emscripten-core/emscripten/pull/7096
      abort("no cryptographic support found for randomDevice. consider polyfilling it if you want to use something insecure like Math.random(), e.g. put this in a --pre-js: var crypto = { getRandomValues: (array) => { for (var i = 0; i < array.length; i++) array[i] = (Math.random()*256)|0 } };");
    };
  var randomFill = (view) => {
      // Lazily init on the first invocation.
      return (randomFill = initRandomFill())(view);
    };
  
  
  
  var PATH_FS = {
  resolve:function() {
        var resolvedPath = '',
          resolvedAbsolute = false;
        for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
          var path = (i >= 0) ? arguments[i] : FS.cwd();
          // Skip empty and invalid entries
          if (typeof path != 'string') {
            throw new TypeError('Arguments to path.resolve must be strings');
          } else if (!path) {
            return ''; // an invalid portion invalidates the whole thing
          }
          resolvedPath = path + '/' + resolvedPath;
          resolvedAbsolute = PATH.isAbs(path);
        }
        // At this point the path should be resolved to a full absolute path, but
        // handle relative paths to be safe (might happen when process.cwd() fails)
        resolvedPath = PATH.normalizeArray(resolvedPath.split('/').filter((p) => !!p), !resolvedAbsolute).join('/');
        return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
      },
  relative:(from, to) => {
        from = PATH_FS.resolve(from).substr(1);
        to = PATH_FS.resolve(to).substr(1);
        function trim(arr) {
          var start = 0;
          for (; start < arr.length; start++) {
            if (arr[start] !== '') break;
          }
          var end = arr.length - 1;
          for (; end >= 0; end--) {
            if (arr[end] !== '') break;
          }
          if (start > end) return [];
          return arr.slice(start, end - start + 1);
        }
        var fromParts = trim(from.split('/'));
        var toParts = trim(to.split('/'));
        var length = Math.min(fromParts.length, toParts.length);
        var samePartsLength = length;
        for (var i = 0; i < length; i++) {
          if (fromParts[i] !== toParts[i]) {
            samePartsLength = i;
            break;
          }
        }
        var outputParts = [];
        for (var i = samePartsLength; i < fromParts.length; i++) {
          outputParts.push('..');
        }
        outputParts = outputParts.concat(toParts.slice(samePartsLength));
        return outputParts.join('/');
      },
  };
  
  
  var UTF8Decoder = typeof TextDecoder != 'undefined' ? new TextDecoder('utf8') : undefined;
  
    /**
     * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
     * array that contains uint8 values, returns a copy of that string as a
     * Javascript String object.
     * heapOrArray is either a regular array, or a JavaScript typed array view.
     * @param {number} idx
     * @param {number=} maxBytesToRead
     * @return {string}
     */
  var UTF8ArrayToString = (heapOrArray, idx, maxBytesToRead) => {
      var endIdx = idx + maxBytesToRead;
      var endPtr = idx;
      // TextDecoder needs to know the byte length in advance, it doesn't stop on
      // null terminator by itself.  Also, use the length info to avoid running tiny
      // strings through TextDecoder, since .subarray() allocates garbage.
      // (As a tiny code save trick, compare endPtr against endIdx using a negation,
      // so that undefined means Infinity)
      while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
  
      if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
        return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
      }
      var str = '';
      // If building with TextDecoder, we have already computed the string length
      // above, so test loop end condition against that
      while (idx < endPtr) {
        // For UTF8 byte structure, see:
        // http://en.wikipedia.org/wiki/UTF-8#Description
        // https://www.ietf.org/rfc/rfc2279.txt
        // https://tools.ietf.org/html/rfc3629
        var u0 = heapOrArray[idx++];
        if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
        var u1 = heapOrArray[idx++] & 63;
        if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
        var u2 = heapOrArray[idx++] & 63;
        if ((u0 & 0xF0) == 0xE0) {
          u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
        } else {
          if ((u0 & 0xF8) != 0xF0) warnOnce('Invalid UTF-8 leading byte ' + ptrToString(u0) + ' encountered when deserializing a UTF-8 string in wasm memory to a JS string!');
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63);
        }
  
        if (u0 < 0x10000) {
          str += String.fromCharCode(u0);
        } else {
          var ch = u0 - 0x10000;
          str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
        }
      }
      return str;
    };
  
  var FS_stdin_getChar_buffer = [];
  
  var lengthBytesUTF8 = (str) => {
      var len = 0;
      for (var i = 0; i < str.length; ++i) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
        // unit, not a Unicode code point of the character! So decode
        // UTF16->UTF32->UTF8.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        var c = str.charCodeAt(i); // possibly a lead surrogate
        if (c <= 0x7F) {
          len++;
        } else if (c <= 0x7FF) {
          len += 2;
        } else if (c >= 0xD800 && c <= 0xDFFF) {
          len += 4; ++i;
        } else {
          len += 3;
        }
      }
      return len;
    };
  
  var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
      assert(typeof str === 'string', `stringToUTF8Array expects a string (got ${typeof str})`);
      // Parameter maxBytesToWrite is not optional. Negative values, 0, null,
      // undefined and false each don't write out any bytes.
      if (!(maxBytesToWrite > 0))
        return 0;
  
      var startIdx = outIdx;
      var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
      for (var i = 0; i < str.length; ++i) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
        // unit, not a Unicode code point of the character! So decode
        // UTF16->UTF32->UTF8.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
        // and https://www.ietf.org/rfc/rfc2279.txt
        // and https://tools.ietf.org/html/rfc3629
        var u = str.charCodeAt(i); // possibly a lead surrogate
        if (u >= 0xD800 && u <= 0xDFFF) {
          var u1 = str.charCodeAt(++i);
          u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
        }
        if (u <= 0x7F) {
          if (outIdx >= endIdx) break;
          heap[outIdx++] = u;
        } else if (u <= 0x7FF) {
          if (outIdx + 1 >= endIdx) break;
          heap[outIdx++] = 0xC0 | (u >> 6);
          heap[outIdx++] = 0x80 | (u & 63);
        } else if (u <= 0xFFFF) {
          if (outIdx + 2 >= endIdx) break;
          heap[outIdx++] = 0xE0 | (u >> 12);
          heap[outIdx++] = 0x80 | ((u >> 6) & 63);
          heap[outIdx++] = 0x80 | (u & 63);
        } else {
          if (outIdx + 3 >= endIdx) break;
          if (u > 0x10FFFF) warnOnce('Invalid Unicode code point ' + ptrToString(u) + ' encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF).');
          heap[outIdx++] = 0xF0 | (u >> 18);
          heap[outIdx++] = 0x80 | ((u >> 12) & 63);
          heap[outIdx++] = 0x80 | ((u >> 6) & 63);
          heap[outIdx++] = 0x80 | (u & 63);
        }
      }
      // Null-terminate the pointer to the buffer.
      heap[outIdx] = 0;
      return outIdx - startIdx;
    };
  /** @type {function(string, boolean=, number=)} */
  function intArrayFromString(stringy, dontAddNull, length) {
    var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
    var u8array = new Array(len);
    var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
    if (dontAddNull) u8array.length = numBytesWritten;
    return u8array;
  }
  var FS_stdin_getChar = () => {
      if (!FS_stdin_getChar_buffer.length) {
        var result = null;
        if (false) {
          // we will read data by chunks of BUFSIZE
          var BUFSIZE = 256;
          var buf = Buffer.alloc(BUFSIZE);
          var bytesRead = 0;
  
          // For some reason we must suppress a closure warning here, even though
          // fd definitely exists on process.stdin, and is even the proper way to
          // get the fd of stdin,
          // https://github.com/nodejs/help/issues/2136#issuecomment-523649904
          // This started to happen after moving this logic out of library_tty.js,
          // so it is related to the surrounding code in some unclear manner.
          /** @suppress {missingProperties} */
          var fd = process.stdin.fd;
  
          try {
            bytesRead = fs.readSync(fd, buf);
          } catch(e) {
            // Cross-platform differences: on Windows, reading EOF throws an exception, but on other OSes,
            // reading EOF returns 0. Uniformize behavior by treating the EOF exception to return 0.
            if (e.toString().includes('EOF')) bytesRead = 0;
            else throw e;
          }
  
          if (bytesRead > 0) {
            result = buf.slice(0, bytesRead).toString('utf-8');
          } else {
            result = null;
          }
        } else
        if (typeof window != 'undefined' &&
          typeof window.prompt == 'function') {
          // Browser.
          result = window.prompt('Input: ');  // returns null on cancel
          if (result !== null) {
            result += '\n';
          }
        } else if (typeof readline == 'function') {
          // Command line.
          result = readline();
          if (result !== null) {
            result += '\n';
          }
        }
        if (!result) {
          return null;
        }
        FS_stdin_getChar_buffer = intArrayFromString(result, true);
      }
      return FS_stdin_getChar_buffer.shift();
    };
  var TTY = {
  ttys:[],
  init() {
        // https://github.com/emscripten-core/emscripten/pull/1555
        // if (false) {
        //   // currently, FS.init does not distinguish if process.stdin is a file or TTY
        //   // device, it always assumes it's a TTY device. because of this, we're forcing
        //   // process.stdin to UTF8 encoding to at least make stdin reading compatible
        //   // with text files until FS.init can be refactored.
        //   process.stdin.setEncoding('utf8');
        // }
      },
  shutdown() {
        // https://github.com/emscripten-core/emscripten/pull/1555
        // if (false) {
        //   // inolen: any idea as to why node -e 'process.stdin.read()' wouldn't exit immediately (with process.stdin being a tty)?
        //   // isaacs: because now it's reading from the stream, you've expressed interest in it, so that read() kicks off a _read() which creates a ReadReq operation
        //   // inolen: I thought read() in that case was a synchronous operation that just grabbed some amount of buffered data if it exists?
        //   // isaacs: it is. but it also triggers a _read() call, which calls readStart() on the handle
        //   // isaacs: do process.stdin.pause() and i'd think it'd probably close the pending call
        //   process.stdin.pause();
        // }
      },
  register(dev, ops) {
        TTY.ttys[dev] = { input: [], output: [], ops: ops };
        FS.registerDevice(dev, TTY.stream_ops);
      },
  stream_ops:{
  open(stream) {
          var tty = TTY.ttys[stream.node.rdev];
          if (!tty) {
            throw new FS.ErrnoError(43);
          }
          stream.tty = tty;
          stream.seekable = false;
        },
  close(stream) {
          // flush any pending line data
          stream.tty.ops.fsync(stream.tty);
        },
  fsync(stream) {
          stream.tty.ops.fsync(stream.tty);
        },
  read(stream, buffer, offset, length, pos /* ignored */) {
          if (!stream.tty || !stream.tty.ops.get_char) {
            throw new FS.ErrnoError(60);
          }
          var bytesRead = 0;
          for (var i = 0; i < length; i++) {
            var result;
            try {
              result = stream.tty.ops.get_char(stream.tty);
            } catch (e) {
              throw new FS.ErrnoError(29);
            }
            if (result === undefined && bytesRead === 0) {
              throw new FS.ErrnoError(6);
            }
            if (result === null || result === undefined) break;
            bytesRead++;
            buffer[offset+i] = result;
          }
          if (bytesRead) {
            stream.node.timestamp = Date.now();
          }
          return bytesRead;
        },
  write(stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.put_char) {
            throw new FS.ErrnoError(60);
          }
          try {
            for (var i = 0; i < length; i++) {
              stream.tty.ops.put_char(stream.tty, buffer[offset+i]);
            }
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
          if (length) {
            stream.node.timestamp = Date.now();
          }
          return i;
        },
  },
  default_tty_ops:{
  get_char(tty) {
          return FS_stdin_getChar();
        },
  put_char(tty, val) {
          if (val === null || val === 10) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val); // val == 0 would cut text output off in the middle.
          }
        },
  fsync(tty) {
          if (tty.output && tty.output.length > 0) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        },
  ioctl_tcgets(tty) {
          // typical setting
          return {
            c_iflag: 25856,
            c_oflag: 5,
            c_cflag: 191,
            c_lflag: 35387,
            c_cc: [
              0x03, 0x1c, 0x7f, 0x15, 0x04, 0x00, 0x01, 0x00, 0x11, 0x13, 0x1a, 0x00,
              0x12, 0x0f, 0x17, 0x16, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
              0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            ]
          };
        },
  ioctl_tcsets(tty, optional_actions, data) {
          // currently just ignore
          return 0;
        },
  ioctl_tiocgwinsz(tty) {
          return [24, 80];
        },
  },
  default_tty1_ops:{
  put_char(tty, val) {
          if (val === null || val === 10) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        },
  fsync(tty) {
          if (tty.output && tty.output.length > 0) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        },
  },
  };
  
  
  var zeroMemory = (address, size) => {
      HEAPU8.fill(0, address, address + size);
      return address;
    };
  
  var alignMemory = (size, alignment) => {
      assert(alignment, "alignment argument is required");
      return Math.ceil(size / alignment) * alignment;
    };
  var mmapAlloc = (size) => {
      size = alignMemory(size, 65536);
      var ptr = _emscripten_builtin_memalign(65536, size);
      if (!ptr) return 0;
      return zeroMemory(ptr, size);
    };
  var MEMFS = {
  ops_table:null,
  mount(mount) {
        return MEMFS.createNode(null, '/', 16384 | 511 /* 0777 */, 0);
      },
  createNode(parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
          // no supported
          throw new FS.ErrnoError(63);
        }
        if (!MEMFS.ops_table) {
          MEMFS.ops_table = {
            dir: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                lookup: MEMFS.node_ops.lookup,
                mknod: MEMFS.node_ops.mknod,
                rename: MEMFS.node_ops.rename,
                unlink: MEMFS.node_ops.unlink,
                rmdir: MEMFS.node_ops.rmdir,
                readdir: MEMFS.node_ops.readdir,
                symlink: MEMFS.node_ops.symlink
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek
              }
            },
            file: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek,
                read: MEMFS.stream_ops.read,
                write: MEMFS.stream_ops.write,
                allocate: MEMFS.stream_ops.allocate,
                mmap: MEMFS.stream_ops.mmap,
                msync: MEMFS.stream_ops.msync
              }
            },
            link: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                readlink: MEMFS.node_ops.readlink
              },
              stream: {}
            },
            chrdev: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: FS.chrdev_stream_ops
            }
          };
        }
        var node = FS.createNode(parent, name, mode, dev);
        if (FS.isDir(node.mode)) {
          node.node_ops = MEMFS.ops_table.dir.node;
          node.stream_ops = MEMFS.ops_table.dir.stream;
          node.contents = {};
        } else if (FS.isFile(node.mode)) {
          node.node_ops = MEMFS.ops_table.file.node;
          node.stream_ops = MEMFS.ops_table.file.stream;
          node.usedBytes = 0; // The actual number of bytes used in the typed array, as opposed to contents.length which gives the whole capacity.
          // When the byte data of the file is populated, this will point to either a typed array, or a normal JS array. Typed arrays are preferred
          // for performance, and used by default. However, typed arrays are not resizable like normal JS arrays are, so there is a small disk size
          // penalty involved for appending file writes that continuously grow a file similar to std::vector capacity vs used -scheme.
          node.contents = null; 
        } else if (FS.isLink(node.mode)) {
          node.node_ops = MEMFS.ops_table.link.node;
          node.stream_ops = MEMFS.ops_table.link.stream;
        } else if (FS.isChrdev(node.mode)) {
          node.node_ops = MEMFS.ops_table.chrdev.node;
          node.stream_ops = MEMFS.ops_table.chrdev.stream;
        }
        node.timestamp = Date.now();
        // add the new node to the parent
        if (parent) {
          parent.contents[name] = node;
          parent.timestamp = node.timestamp;
        }
        return node;
      },
  getFileDataAsTypedArray(node) {
        if (!node.contents) return new Uint8Array(0);
        if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes); // Make sure to not return excess unused bytes.
        return new Uint8Array(node.contents);
      },
  expandFileStorage(node, newCapacity) {
        var prevCapacity = node.contents ? node.contents.length : 0;
        if (prevCapacity >= newCapacity) return; // No need to expand, the storage was already large enough.
        // Don't expand strictly to the given requested limit if it's only a very small increase, but instead geometrically grow capacity.
        // For small filesizes (<1MB), perform size*2 geometric increase, but for large sizes, do a much more conservative size*1.125 increase to
        // avoid overshooting the allocation cap by a very large margin.
        var CAPACITY_DOUBLING_MAX = 1024 * 1024;
        newCapacity = Math.max(newCapacity, (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2.0 : 1.125)) >>> 0);
        if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256); // At minimum allocate 256b for each file when expanding.
        var oldContents = node.contents;
        node.contents = new Uint8Array(newCapacity); // Allocate new storage.
        if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0); // Copy old data over to the new storage.
      },
  resizeFileStorage(node, newSize) {
        if (node.usedBytes == newSize) return;
        if (newSize == 0) {
          node.contents = null; // Fully decommit when requesting a resize to zero.
          node.usedBytes = 0;
        } else {
          var oldContents = node.contents;
          node.contents = new Uint8Array(newSize); // Allocate new storage.
          if (oldContents) {
            node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes))); // Copy old data over to the new storage.
          }
          node.usedBytes = newSize;
        }
      },
  node_ops:{
  getattr(node) {
          var attr = {};
          // device numbers reuse inode numbers.
          attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
          attr.ino = node.id;
          attr.mode = node.mode;
          attr.nlink = 1;
          attr.uid = 0;
          attr.gid = 0;
          attr.rdev = node.rdev;
          if (FS.isDir(node.mode)) {
            attr.size = 4096;
          } else if (FS.isFile(node.mode)) {
            attr.size = node.usedBytes;
          } else if (FS.isLink(node.mode)) {
            attr.size = node.link.length;
          } else {
            attr.size = 0;
          }
          attr.atime = new Date(node.timestamp);
          attr.mtime = new Date(node.timestamp);
          attr.ctime = new Date(node.timestamp);
          // NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
          //       but this is not required by the standard.
          attr.blksize = 4096;
          attr.blocks = Math.ceil(attr.size / attr.blksize);
          return attr;
        },
  setattr(node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp;
          }
          if (attr.size !== undefined) {
            MEMFS.resizeFileStorage(node, attr.size);
          }
        },
  lookup(parent, name) {
          throw FS.genericErrors[44];
        },
  mknod(parent, name, mode, dev) {
          return MEMFS.createNode(parent, name, mode, dev);
        },
  rename(old_node, new_dir, new_name) {
          // if we're overwriting a directory at new_name, make sure it's empty.
          if (FS.isDir(old_node.mode)) {
            var new_node;
            try {
              new_node = FS.lookupNode(new_dir, new_name);
            } catch (e) {
            }
            if (new_node) {
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(55);
              }
            }
          }
          // do the internal rewiring
          delete old_node.parent.contents[old_node.name];
          old_node.parent.timestamp = Date.now()
          old_node.name = new_name;
          new_dir.contents[new_name] = old_node;
          new_dir.timestamp = old_node.parent.timestamp;
          old_node.parent = new_dir;
        },
  unlink(parent, name) {
          delete parent.contents[name];
          parent.timestamp = Date.now();
        },
  rmdir(parent, name) {
          var node = FS.lookupNode(parent, name);
          for (var i in node.contents) {
            throw new FS.ErrnoError(55);
          }
          delete parent.contents[name];
          parent.timestamp = Date.now();
        },
  readdir(node) {
          var entries = ['.', '..'];
          for (var key in node.contents) {
            if (!node.contents.hasOwnProperty(key)) {
              continue;
            }
            entries.push(key);
          }
          return entries;
        },
  symlink(parent, newname, oldpath) {
          var node = MEMFS.createNode(parent, newname, 511 /* 0777 */ | 40960, 0);
          node.link = oldpath;
          return node;
        },
  readlink(node) {
          if (!FS.isLink(node.mode)) {
            throw new FS.ErrnoError(28);
          }
          return node.link;
        },
  },
  stream_ops:{
  read(stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= stream.node.usedBytes) return 0;
          var size = Math.min(stream.node.usedBytes - position, length);
          assert(size >= 0);
          if (size > 8 && contents.subarray) { // non-trivial, and typed array
            buffer.set(contents.subarray(position, position + size), offset);
          } else {
            for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
          }
          return size;
        },
  write(stream, buffer, offset, length, position, canOwn) {
          // The data buffer should be a typed array view
          assert(!(buffer instanceof ArrayBuffer));
          // If the buffer is located in main memory (HEAP), and if
          // memory can grow, we can't hold on to references of the
          // memory buffer, as they may get invalidated. That means we
          // need to do copy its contents.
          if (buffer.buffer === HEAP8.buffer) {
            canOwn = false;
          }
  
          if (!length) return 0;
          var node = stream.node;
          node.timestamp = Date.now();
  
          if (buffer.subarray && (!node.contents || node.contents.subarray)) { // This write is from a typed array to a typed array?
            if (canOwn) {
              assert(position === 0, 'canOwn must imply no weird position inside the file');
              node.contents = buffer.subarray(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (node.usedBytes === 0 && position === 0) { // If this is a simple first write to an empty file, do a fast set since we don't need to care about old data.
              node.contents = buffer.slice(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (position + length <= node.usedBytes) { // Writing to an already allocated and used subrange of the file?
              node.contents.set(buffer.subarray(offset, offset + length), position);
              return length;
            }
          }
  
          // Appending to an existing file and we need to reallocate, or source data did not come as a typed array.
          MEMFS.expandFileStorage(node, position+length);
          if (node.contents.subarray && buffer.subarray) {
            // Use typed array write which is available.
            node.contents.set(buffer.subarray(offset, offset + length), position);
          } else {
            for (var i = 0; i < length; i++) {
             node.contents[position + i] = buffer[offset + i]; // Or fall back to manual write if not.
            }
          }
          node.usedBytes = Math.max(node.usedBytes, position + length);
          return length;
        },
  llseek(stream, offset, whence) {
          var position = offset;
          if (whence === 1) {
            position += stream.position;
          } else if (whence === 2) {
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.usedBytes;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(28);
          }
          return position;
        },
  allocate(stream, offset, length) {
          MEMFS.expandFileStorage(stream.node, offset + length);
          stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
        },
  mmap(stream, length, position, prot, flags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          var ptr;
          var allocated;
          var contents = stream.node.contents;
          // Only make a new copy when MAP_PRIVATE is specified.
          if (!(flags & 2) && contents.buffer === HEAP8.buffer) {
            // We can't emulate MAP_SHARED when the file is not backed by the
            // buffer we're mapping to (e.g. the HEAP buffer).
            allocated = false;
            ptr = contents.byteOffset;
          } else {
            // Try to avoid unnecessary slices.
            if (position > 0 || position + length < contents.length) {
              if (contents.subarray) {
                contents = contents.subarray(position, position + length);
              } else {
                contents = Array.prototype.slice.call(contents, position, position + length);
              }
            }
            allocated = true;
            ptr = mmapAlloc(length);
            if (!ptr) {
              throw new FS.ErrnoError(48);
            }
            HEAP8.set(contents, ptr);
          }
          return { ptr, allocated };
        },
  msync(stream, buffer, offset, length, mmapFlags) {
          MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
          // should we check if bytesWritten and length are the same?
          return 0;
        },
  },
  };
  
  /** @param {boolean=} noRunDep */
  var asyncLoad = (url, onload, onerror, noRunDep) => {
      var dep = !noRunDep ? getUniqueRunDependency(`al ${url}`) : '';
      readAsync(url, (arrayBuffer) => {
        assert(arrayBuffer, `Loading data file "${url}" failed (no arrayBuffer).`);
        onload(new Uint8Array(arrayBuffer));
        if (dep) removeRunDependency(dep);
      }, (event) => {
        if (onerror) {
          onerror();
        } else {
          throw `Loading data file "${url}" failed.`;
        }
      });
      if (dep) addRunDependency(dep);
    };
  
  
  var FS_createDataFile = (parent, name, fileData, canRead, canWrite, canOwn) => {
      FS.createDataFile(parent, name, fileData, canRead, canWrite, canOwn);
    };
  
  var preloadPlugins = Module['preloadPlugins'] || [];
  var FS_handledByPreloadPlugin = (byteArray, fullname, finish, onerror) => {
      // Ensure plugins are ready.
      if (typeof Browser != 'undefined') Browser.init();
  
      var handled = false;
      preloadPlugins.forEach((plugin) => {
        if (handled) return;
        if (plugin['canHandle'](fullname)) {
          plugin['handle'](byteArray, fullname, finish, onerror);
          handled = true;
        }
      });
      return handled;
    };
  var FS_createPreloadedFile = (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) => {
      // TODO we should allow people to just pass in a complete filename instead
      // of parent and name being that we just join them anyways
      var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
      var dep = getUniqueRunDependency(`cp ${fullname}`); // might have several active requests for the same fullname
      function processData(byteArray) {
        function finish(byteArray) {
          if (preFinish) preFinish();
          if (!dontCreateFile) {
            FS_createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
          }
          if (onload) onload();
          removeRunDependency(dep);
        }
        if (FS_handledByPreloadPlugin(byteArray, fullname, finish, () => {
          if (onerror) onerror();
          removeRunDependency(dep);
        })) {
          return;
        }
        finish(byteArray);
      }
      addRunDependency(dep);
      if (typeof url == 'string') {
        asyncLoad(url, (byteArray) => processData(byteArray), onerror);
      } else {
        processData(url);
      }
    };
  
  var FS_modeStringToFlags = (str) => {
      var flagModes = {
        'r': 0,
        'r+': 2,
        'w': 512 | 64 | 1,
        'w+': 512 | 64 | 2,
        'a': 1024 | 64 | 1,
        'a+': 1024 | 64 | 2,
      };
      var flags = flagModes[str];
      if (typeof flags == 'undefined') {
        throw new Error(`Unknown file open mode: ${str}`);
      }
      return flags;
    };
  
  var FS_getMode = (canRead, canWrite) => {
      var mode = 0;
      if (canRead) mode |= 292 | 73;
      if (canWrite) mode |= 146;
      return mode;
    };
  
  
  
  
  var ERRNO_MESSAGES = {
  0:"Success",
  1:"Arg list too long",
  2:"Permission denied",
  3:"Address already in use",
  4:"Address not available",
  5:"Address family not supported by protocol family",
  6:"No more processes",
  7:"Socket already connected",
  8:"Bad file number",
  9:"Trying to read unreadable message",
  10:"Mount device busy",
  11:"Operation canceled",
  12:"No children",
  13:"Connection aborted",
  14:"Connection refused",
  15:"Connection reset by peer",
  16:"File locking deadlock error",
  17:"Destination address required",
  18:"Math arg out of domain of func",
  19:"Quota exceeded",
  20:"File exists",
  21:"Bad address",
  22:"File too large",
  23:"Host is unreachable",
  24:"Identifier removed",
  25:"Illegal byte sequence",
  26:"Connection already in progress",
  27:"Interrupted system call",
  28:"Invalid argument",
  29:"I/O error",
  30:"Socket is already connected",
  31:"Is a directory",
  32:"Too many symbolic links",
  33:"Too many open files",
  34:"Too many links",
  35:"Message too long",
  36:"Multihop attempted",
  37:"File or path name too long",
  38:"Network interface is not configured",
  39:"Connection reset by network",
  40:"Network is unreachable",
  41:"Too many open files in system",
  42:"No buffer space available",
  43:"No such device",
  44:"No such file or directory",
  45:"Exec format error",
  46:"No record locks available",
  47:"The link has been severed",
  48:"Not enough core",
  49:"No message of desired type",
  50:"Protocol not available",
  51:"No space left on device",
  52:"Function not implemented",
  53:"Socket is not connected",
  54:"Not a directory",
  55:"Directory not empty",
  56:"State not recoverable",
  57:"Socket operation on non-socket",
  59:"Not a typewriter",
  60:"No such device or address",
  61:"Value too large for defined data type",
  62:"Previous owner died",
  63:"Not super-user",
  64:"Broken pipe",
  65:"Protocol error",
  66:"Unknown protocol",
  67:"Protocol wrong type for socket",
  68:"Math result not representable",
  69:"Read only file system",
  70:"Illegal seek",
  71:"No such process",
  72:"Stale file handle",
  73:"Connection timed out",
  74:"Text file busy",
  75:"Cross-device link",
  100:"Device not a stream",
  101:"Bad font file fmt",
  102:"Invalid slot",
  103:"Invalid request code",
  104:"No anode",
  105:"Block device required",
  106:"Channel number out of range",
  107:"Level 3 halted",
  108:"Level 3 reset",
  109:"Link number out of range",
  110:"Protocol driver not attached",
  111:"No CSI structure available",
  112:"Level 2 halted",
  113:"Invalid exchange",
  114:"Invalid request descriptor",
  115:"Exchange full",
  116:"No data (for no delay io)",
  117:"Timer expired",
  118:"Out of streams resources",
  119:"Machine is not on the network",
  120:"Package not installed",
  121:"The object is remote",
  122:"Advertise error",
  123:"Srmount error",
  124:"Communication error on send",
  125:"Cross mount point (not really error)",
  126:"Given log. name not unique",
  127:"f.d. invalid for this operation",
  128:"Remote address changed",
  129:"Can   access a needed shared lib",
  130:"Accessing a corrupted shared lib",
  131:".lib section in a.out corrupted",
  132:"Attempting to link in too many libs",
  133:"Attempting to exec a shared library",
  135:"Streams pipe error",
  136:"Too many users",
  137:"Socket type not supported",
  138:"Not supported",
  139:"Protocol family not supported",
  140:"Can't send after socket shutdown",
  141:"Too many references",
  142:"Host is down",
  148:"No medium (in tape drive)",
  156:"Level 2 not synchronized",
  };
  
  var ERRNO_CODES = {
      'EPERM': 63,
      'ENOENT': 44,
      'ESRCH': 71,
      'EINTR': 27,
      'EIO': 29,
      'ENXIO': 60,
      'E2BIG': 1,
      'ENOEXEC': 45,
      'EBADF': 8,
      'ECHILD': 12,
      'EAGAIN': 6,
      'EWOULDBLOCK': 6,
      'ENOMEM': 48,
      'EACCES': 2,
      'EFAULT': 21,
      'ENOTBLK': 105,
      'EBUSY': 10,
      'EEXIST': 20,
      'EXDEV': 75,
      'ENODEV': 43,
      'ENOTDIR': 54,
      'EISDIR': 31,
      'EINVAL': 28,
      'ENFILE': 41,
      'EMFILE': 33,
      'ENOTTY': 59,
      'ETXTBSY': 74,
      'EFBIG': 22,
      'ENOSPC': 51,
      'ESPIPE': 70,
      'EROFS': 69,
      'EMLINK': 34,
      'EPIPE': 64,
      'EDOM': 18,
      'ERANGE': 68,
      'ENOMSG': 49,
      'EIDRM': 24,
      'ECHRNG': 106,
      'EL2NSYNC': 156,
      'EL3HLT': 107,
      'EL3RST': 108,
      'ELNRNG': 109,
      'EUNATCH': 110,
      'ENOCSI': 111,
      'EL2HLT': 112,
      'EDEADLK': 16,
      'ENOLCK': 46,
      'EBADE': 113,
      'EBADR': 114,
      'EXFULL': 115,
      'ENOANO': 104,
      'EBADRQC': 103,
      'EBADSLT': 102,
      'EDEADLOCK': 16,
      'EBFONT': 101,
      'ENOSTR': 100,
      'ENODATA': 116,
      'ETIME': 117,
      'ENOSR': 118,
      'ENONET': 119,
      'ENOPKG': 120,
      'EREMOTE': 121,
      'ENOLINK': 47,
      'EADV': 122,
      'ESRMNT': 123,
      'ECOMM': 124,
      'EPROTO': 65,
      'EMULTIHOP': 36,
      'EDOTDOT': 125,
      'EBADMSG': 9,
      'ENOTUNIQ': 126,
      'EBADFD': 127,
      'EREMCHG': 128,
      'ELIBACC': 129,
      'ELIBBAD': 130,
      'ELIBSCN': 131,
      'ELIBMAX': 132,
      'ELIBEXEC': 133,
      'ENOSYS': 52,
      'ENOTEMPTY': 55,
      'ENAMETOOLONG': 37,
      'ELOOP': 32,
      'EOPNOTSUPP': 138,
      'EPFNOSUPPORT': 139,
      'ECONNRESET': 15,
      'ENOBUFS': 42,
      'EAFNOSUPPORT': 5,
      'EPROTOTYPE': 67,
      'ENOTSOCK': 57,
      'ENOPROTOOPT': 50,
      'ESHUTDOWN': 140,
      'ECONNREFUSED': 14,
      'EADDRINUSE': 3,
      'ECONNABORTED': 13,
      'ENETUNREACH': 40,
      'ENETDOWN': 38,
      'ETIMEDOUT': 73,
      'EHOSTDOWN': 142,
      'EHOSTUNREACH': 23,
      'EINPROGRESS': 26,
      'EALREADY': 7,
      'EDESTADDRREQ': 17,
      'EMSGSIZE': 35,
      'EPROTONOSUPPORT': 66,
      'ESOCKTNOSUPPORT': 137,
      'EADDRNOTAVAIL': 4,
      'ENETRESET': 39,
      'EISCONN': 30,
      'ENOTCONN': 53,
      'ETOOMANYREFS': 141,
      'EUSERS': 136,
      'EDQUOT': 19,
      'ESTALE': 72,
      'ENOTSUP': 138,
      'ENOMEDIUM': 148,
      'EILSEQ': 25,
      'EOVERFLOW': 61,
      'ECANCELED': 11,
      'ENOTRECOVERABLE': 56,
      'EOWNERDEAD': 62,
      'ESTRPIPE': 135,
    };
  
  var demangle = (func) => {
      warnOnce('warning: build with -sDEMANGLE_SUPPORT to link in libcxxabi demangling');
      return func;
    };
  var demangleAll = (text) => {
      var regex =
        /\b_Z[\w\d_]+/g;
      return text.replace(regex,
        function(x) {
          var y = demangle(x);
          return x === y ? x : (y + ' [' + x + ']');
        });
    };
  var FS = {
  root:null,
  mounts:[],
  devices:{
  },
  streams:[],
  nextInode:1,
  nameTable:null,
  currentPath:"/",
  initialized:false,
  ignorePermissions:true,
  ErrnoError:null,
  genericErrors:{
  },
  filesystems:null,
  syncFSRequests:0,
  lookupPath(path, opts = {}) {
        path = PATH_FS.resolve(path);
  
        if (!path) return { path: '', node: null };
  
        var defaults = {
          follow_mount: true,
          recurse_count: 0
        };
        opts = Object.assign(defaults, opts)
  
        if (opts.recurse_count > 8) {  // max recursive lookup of 8
          throw new FS.ErrnoError(32);
        }
  
        // split the absolute path
        var parts = path.split('/').filter((p) => !!p);
  
        // start at the root
        var current = FS.root;
        var current_path = '/';
  
        for (var i = 0; i < parts.length; i++) {
          var islast = (i === parts.length-1);
          if (islast && opts.parent) {
            // stop resolving
            break;
          }
  
          current = FS.lookupNode(current, parts[i]);
          current_path = PATH.join2(current_path, parts[i]);
  
          // jump to the mount's root node if this is a mountpoint
          if (FS.isMountpoint(current)) {
            if (!islast || (islast && opts.follow_mount)) {
              current = current.mounted.root;
            }
          }
  
          // by default, lookupPath will not follow a symlink if it is the final path component.
          // setting opts.follow = true will override this behavior.
          if (!islast || opts.follow) {
            var count = 0;
            while (FS.isLink(current.mode)) {
              var link = FS.readlink(current_path);
              current_path = PATH_FS.resolve(PATH.dirname(current_path), link);
  
              var lookup = FS.lookupPath(current_path, { recurse_count: opts.recurse_count + 1 });
              current = lookup.node;
  
              if (count++ > 40) {  // limit max consecutive symlinks to 40 (SYMLOOP_MAX).
                throw new FS.ErrnoError(32);
              }
            }
          }
        }
  
        return { path: current_path, node: current };
      },
  getPath(node) {
        var path;
        while (true) {
          if (FS.isRoot(node)) {
            var mount = node.mount.mountpoint;
            if (!path) return mount;
            return mount[mount.length-1] !== '/' ? `${mount}/${path}` : mount + path;
          }
          path = path ? `${node.name}/${path}` : node.name;
          node = node.parent;
        }
      },
  hashName(parentid, name) {
        var hash = 0;
  
        for (var i = 0; i < name.length; i++) {
          hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
        }
        return ((parentid + hash) >>> 0) % FS.nameTable.length;
      },
  hashAddNode(node) {
        var hash = FS.hashName(node.parent.id, node.name);
        node.name_next = FS.nameTable[hash];
        FS.nameTable[hash] = node;
      },
  hashRemoveNode(node) {
        var hash = FS.hashName(node.parent.id, node.name);
        if (FS.nameTable[hash] === node) {
          FS.nameTable[hash] = node.name_next;
        } else {
          var current = FS.nameTable[hash];
          while (current) {
            if (current.name_next === node) {
              current.name_next = node.name_next;
              break;
            }
            current = current.name_next;
          }
        }
      },
  lookupNode(parent, name) {
        var errCode = FS.mayLookup(parent);
        if (errCode) {
          throw new FS.ErrnoError(errCode, parent);
        }
        var hash = FS.hashName(parent.id, name);
        for (var node = FS.nameTable[hash]; node; node = node.name_next) {
          var nodeName = node.name;
          if (node.parent.id === parent.id && nodeName === name) {
            return node;
          }
        }
        // if we failed to find it in the cache, call into the VFS
        return FS.lookup(parent, name);
      },
  createNode(parent, name, mode, rdev) {
        assert(typeof parent == 'object')
        var node = new FS.FSNode(parent, name, mode, rdev);
  
        FS.hashAddNode(node);
  
        return node;
      },
  destroyNode(node) {
        FS.hashRemoveNode(node);
      },
  isRoot(node) {
        return node === node.parent;
      },
  isMountpoint(node) {
        return !!node.mounted;
      },
  isFile(mode) {
        return (mode & 61440) === 32768;
      },
  isDir(mode) {
        return (mode & 61440) === 16384;
      },
  isLink(mode) {
        return (mode & 61440) === 40960;
      },
  isChrdev(mode) {
        return (mode & 61440) === 8192;
      },
  isBlkdev(mode) {
        return (mode & 61440) === 24576;
      },
  isFIFO(mode) {
        return (mode & 61440) === 4096;
      },
  isSocket(mode) {
        return (mode & 49152) === 49152;
      },
  flagsToPermissionString(flag) {
        var perms = ['r', 'w', 'rw'][flag & 3];
        if ((flag & 512)) {
          perms += 'w';
        }
        return perms;
      },
  nodePermissions(node, perms) {
        if (FS.ignorePermissions) {
          return 0;
        }
        // return 0 if any user, group or owner bits are set.
        if (perms.includes('r') && !(node.mode & 292)) {
          return 2;
        } else if (perms.includes('w') && !(node.mode & 146)) {
          return 2;
        } else if (perms.includes('x') && !(node.mode & 73)) {
          return 2;
        }
        return 0;
      },
  mayLookup(dir) {
        var errCode = FS.nodePermissions(dir, 'x');
        if (errCode) return errCode;
        if (!dir.node_ops.lookup) return 2;
        return 0;
      },
  mayCreate(dir, name) {
        try {
          var node = FS.lookupNode(dir, name);
          return 20;
        } catch (e) {
        }
        return FS.nodePermissions(dir, 'wx');
      },
  mayDelete(dir, name, isdir) {
        var node;
        try {
          node = FS.lookupNode(dir, name);
        } catch (e) {
          return e.errno;
        }
        var errCode = FS.nodePermissions(dir, 'wx');
        if (errCode) {
          return errCode;
        }
        if (isdir) {
          if (!FS.isDir(node.mode)) {
            return 54;
          }
          if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
            return 10;
          }
        } else {
          if (FS.isDir(node.mode)) {
            return 31;
          }
        }
        return 0;
      },
  mayOpen(node, flags) {
        if (!node) {
          return 44;
        }
        if (FS.isLink(node.mode)) {
          return 32;
        } else if (FS.isDir(node.mode)) {
          if (FS.flagsToPermissionString(flags) !== 'r' || // opening for write
              (flags & 512)) { // TODO: check for O_SEARCH? (== search for dir only)
            return 31;
          }
        }
        return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
      },
  MAX_OPEN_FDS:4096,
  nextfd() {
        for (var fd = 0; fd <= FS.MAX_OPEN_FDS; fd++) {
          if (!FS.streams[fd]) {
            return fd;
          }
        }
        throw new FS.ErrnoError(33);
      },
  getStreamChecked(fd) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(8);
        }
        return stream;
      },
  getStream:(fd) => FS.streams[fd],
  createStream(stream, fd = -1) {
        if (!FS.FSStream) {
          FS.FSStream = /** @constructor */ function() {
            this.shared = { };
          };
          FS.FSStream.prototype = {};
          Object.defineProperties(FS.FSStream.prototype, {
            object: {
              /** @this {FS.FSStream} */
              get() { return this.node; },
              /** @this {FS.FSStream} */
              set(val) { this.node = val; }
            },
            isRead: {
              /** @this {FS.FSStream} */
              get() { return (this.flags & 2097155) !== 1; }
            },
            isWrite: {
              /** @this {FS.FSStream} */
              get() { return (this.flags & 2097155) !== 0; }
            },
            isAppend: {
              /** @this {FS.FSStream} */
              get() { return (this.flags & 1024); }
            },
            flags: {
              /** @this {FS.FSStream} */
              get() { return this.shared.flags; },
              /** @this {FS.FSStream} */
              set(val) { this.shared.flags = val; },
            },
            position : {
              /** @this {FS.FSStream} */
              get() { return this.shared.position; },
              /** @this {FS.FSStream} */
              set(val) { this.shared.position = val; },
            },
          });
        }
        // clone it, so we can return an instance of FSStream
        stream = Object.assign(new FS.FSStream(), stream);
        if (fd == -1) {
          fd = FS.nextfd();
        }
        stream.fd = fd;
        FS.streams[fd] = stream;
        return stream;
      },
  closeStream(fd) {
        FS.streams[fd] = null;
      },
  chrdev_stream_ops:{
  open(stream) {
          var device = FS.getDevice(stream.node.rdev);
          // override node's stream ops with the device's
          stream.stream_ops = device.stream_ops;
          // forward the open call
          if (stream.stream_ops.open) {
            stream.stream_ops.open(stream);
          }
        },
  llseek() {
          throw new FS.ErrnoError(70);
        },
  },
  major:(dev) => ((dev) >> 8),
  minor:(dev) => ((dev) & 0xff),
  makedev:(ma, mi) => ((ma) << 8 | (mi)),
  registerDevice(dev, ops) {
        FS.devices[dev] = { stream_ops: ops };
      },
  getDevice:(dev) => FS.devices[dev],
  getMounts(mount) {
        var mounts = [];
        var check = [mount];
  
        while (check.length) {
          var m = check.pop();
  
          mounts.push(m);
  
          check.push.apply(check, m.mounts);
        }
  
        return mounts;
      },
  syncfs(populate, callback) {
        if (typeof populate == 'function') {
          callback = populate;
          populate = false;
        }
  
        FS.syncFSRequests++;
  
        if (FS.syncFSRequests > 1) {
          err(`warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`);
        }
  
        var mounts = FS.getMounts(FS.root.mount);
        var completed = 0;
  
        function doCallback(errCode) {
          assert(FS.syncFSRequests > 0);
          FS.syncFSRequests--;
          return callback(errCode);
        }
  
        function done(errCode) {
          if (errCode) {
            if (!done.errored) {
              done.errored = true;
              return doCallback(errCode);
            }
            return;
          }
          if (++completed >= mounts.length) {
            doCallback(null);
          }
        };
  
        // sync all mounts
        mounts.forEach((mount) => {
          if (!mount.type.syncfs) {
            return done(null);
          }
          mount.type.syncfs(mount, populate, done);
        });
      },
  mount(type, opts, mountpoint) {
        if (typeof type == 'string') {
          // The filesystem was not included, and instead we have an error
          // message stored in the variable.
          throw type;
        }
        var root = mountpoint === '/';
        var pseudo = !mountpoint;
        var node;
  
        if (root && FS.root) {
          throw new FS.ErrnoError(10);
        } else if (!root && !pseudo) {
          var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
          mountpoint = lookup.path;  // use the absolute path
          node = lookup.node;
  
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(10);
          }
  
          if (!FS.isDir(node.mode)) {
            throw new FS.ErrnoError(54);
          }
        }
  
        var mount = {
          type,
          opts,
          mountpoint,
          mounts: []
        };
  
        // create a root node for the fs
        var mountRoot = type.mount(mount);
        mountRoot.mount = mount;
        mount.root = mountRoot;
  
        if (root) {
          FS.root = mountRoot;
        } else if (node) {
          // set as a mountpoint
          node.mounted = mount;
  
          // add the new mount to the current mount's children
          if (node.mount) {
            node.mount.mounts.push(mount);
          }
        }
  
        return mountRoot;
      },
  unmount(mountpoint) {
        var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
        if (!FS.isMountpoint(lookup.node)) {
          throw new FS.ErrnoError(28);
        }
  
        // destroy the nodes for this mount, and all its child mounts
        var node = lookup.node;
        var mount = node.mounted;
        var mounts = FS.getMounts(mount);
  
        Object.keys(FS.nameTable).forEach((hash) => {
          var current = FS.nameTable[hash];
  
          while (current) {
            var next = current.name_next;
  
            if (mounts.includes(current.mount)) {
              FS.destroyNode(current);
            }
  
            current = next;
          }
        });
  
        // no longer a mountpoint
        node.mounted = null;
  
        // remove this mount from the child mounts
        var idx = node.mount.mounts.indexOf(mount);
        assert(idx !== -1);
        node.mount.mounts.splice(idx, 1);
      },
  lookup(parent, name) {
        return parent.node_ops.lookup(parent, name);
      },
  mknod(path, mode, dev) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        if (!name || name === '.' || name === '..') {
          throw new FS.ErrnoError(28);
        }
        var errCode = FS.mayCreate(parent, name);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.mknod) {
          throw new FS.ErrnoError(63);
        }
        return parent.node_ops.mknod(parent, name, mode, dev);
      },
  create(path, mode) {
        mode = mode !== undefined ? mode : 438 /* 0666 */;
        mode &= 4095;
        mode |= 32768;
        return FS.mknod(path, mode, 0);
      },
  mkdir(path, mode) {
        mode = mode !== undefined ? mode : 511 /* 0777 */;
        mode &= 511 | 512;
        mode |= 16384;
        return FS.mknod(path, mode, 0);
      },
  mkdirTree(path, mode) {
        var dirs = path.split('/');
        var d = '';
        for (var i = 0; i < dirs.length; ++i) {
          if (!dirs[i]) continue;
          d += '/' + dirs[i];
          try {
            FS.mkdir(d, mode);
          } catch(e) {
            if (e.errno != 20) throw e;
          }
        }
      },
  mkdev(path, mode, dev) {
        if (typeof dev == 'undefined') {
          dev = mode;
          mode = 438 /* 0666 */;
        }
        mode |= 8192;
        return FS.mknod(path, mode, dev);
      },
  symlink(oldpath, newpath) {
        if (!PATH_FS.resolve(oldpath)) {
          throw new FS.ErrnoError(44);
        }
        var lookup = FS.lookupPath(newpath, { parent: true });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(44);
        }
        var newname = PATH.basename(newpath);
        var errCode = FS.mayCreate(parent, newname);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.symlink) {
          throw new FS.ErrnoError(63);
        }
        return parent.node_ops.symlink(parent, newname, oldpath);
      },
  rename(old_path, new_path) {
        var old_dirname = PATH.dirname(old_path);
        var new_dirname = PATH.dirname(new_path);
        var old_name = PATH.basename(old_path);
        var new_name = PATH.basename(new_path);
        // parents must exist
        var lookup, old_dir, new_dir;
  
        // let the errors from non existant directories percolate up
        lookup = FS.lookupPath(old_path, { parent: true });
        old_dir = lookup.node;
        lookup = FS.lookupPath(new_path, { parent: true });
        new_dir = lookup.node;
  
        if (!old_dir || !new_dir) throw new FS.ErrnoError(44);
        // need to be part of the same mount
        if (old_dir.mount !== new_dir.mount) {
          throw new FS.ErrnoError(75);
        }
        // source must exist
        var old_node = FS.lookupNode(old_dir, old_name);
        // old path should not be an ancestor of the new path
        var relative = PATH_FS.relative(old_path, new_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(28);
        }
        // new path should not be an ancestor of the old path
        relative = PATH_FS.relative(new_path, old_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(55);
        }
        // see if the new path already exists
        var new_node;
        try {
          new_node = FS.lookupNode(new_dir, new_name);
        } catch (e) {
          // not fatal
        }
        // early out if nothing needs to change
        if (old_node === new_node) {
          return;
        }
        // we'll need to delete the old entry
        var isdir = FS.isDir(old_node.mode);
        var errCode = FS.mayDelete(old_dir, old_name, isdir);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        // need delete permissions if we'll be overwriting.
        // need create permissions if new doesn't already exist.
        errCode = new_node ?
          FS.mayDelete(new_dir, new_name, isdir) :
          FS.mayCreate(new_dir, new_name);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!old_dir.node_ops.rename) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
          throw new FS.ErrnoError(10);
        }
        // if we are going to change the parent, check write permissions
        if (new_dir !== old_dir) {
          errCode = FS.nodePermissions(old_dir, 'w');
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
        }
        // remove the node from the lookup hash
        FS.hashRemoveNode(old_node);
        // do the underlying fs rename
        try {
          old_dir.node_ops.rename(old_node, new_dir, new_name);
        } catch (e) {
          throw e;
        } finally {
          // add the node back to the hash (in case node_ops.rename
          // changed its name)
          FS.hashAddNode(old_node);
        }
      },
  rmdir(path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, true);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.rmdir) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(10);
        }
        parent.node_ops.rmdir(parent, name);
        FS.destroyNode(node);
      },
  readdir(path) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        if (!node.node_ops.readdir) {
          throw new FS.ErrnoError(54);
        }
        return node.node_ops.readdir(node);
      },
  unlink(path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(44);
        }
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, false);
        if (errCode) {
          // According to POSIX, we should map EISDIR to EPERM, but
          // we instead do what Linux does (and we must, as we use
          // the musl linux libc).
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.unlink) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(10);
        }
        parent.node_ops.unlink(parent, name);
        FS.destroyNode(node);
      },
  readlink(path) {
        var lookup = FS.lookupPath(path);
        var link = lookup.node;
        if (!link) {
          throw new FS.ErrnoError(44);
        }
        if (!link.node_ops.readlink) {
          throw new FS.ErrnoError(28);
        }
        return PATH_FS.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
      },
  stat(path, dontFollow) {
        var lookup = FS.lookupPath(path, { follow: !dontFollow });
        var node = lookup.node;
        if (!node) {
          throw new FS.ErrnoError(44);
        }
        if (!node.node_ops.getattr) {
          throw new FS.ErrnoError(63);
        }
        return node.node_ops.getattr(node);
      },
  lstat(path) {
        return FS.stat(path, true);
      },
  chmod(path, mode, dontFollow) {
        var node;
        if (typeof path == 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }
        node.node_ops.setattr(node, {
          mode: (mode & 4095) | (node.mode & ~4095),
          timestamp: Date.now()
        });
      },
  lchmod(path, mode) {
        FS.chmod(path, mode, true);
      },
  fchmod(fd, mode) {
        var stream = FS.getStreamChecked(fd);
        FS.chmod(stream.node, mode);
      },
  chown(path, uid, gid, dontFollow) {
        var node;
        if (typeof path == 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }
        node.node_ops.setattr(node, {
          timestamp: Date.now()
          // we ignore the uid / gid for now
        });
      },
  lchown(path, uid, gid) {
        FS.chown(path, uid, gid, true);
      },
  fchown(fd, uid, gid) {
        var stream = FS.getStreamChecked(fd);
        FS.chown(stream.node, uid, gid);
      },
  truncate(path, len) {
        if (len < 0) {
          throw new FS.ErrnoError(28);
        }
        var node;
        if (typeof path == 'string') {
          var lookup = FS.lookupPath(path, { follow: true });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isDir(node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!FS.isFile(node.mode)) {
          throw new FS.ErrnoError(28);
        }
        var errCode = FS.nodePermissions(node, 'w');
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        node.node_ops.setattr(node, {
          size: len,
          timestamp: Date.now()
        });
      },
  ftruncate(fd, len) {
        var stream = FS.getStreamChecked(fd);
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(28);
        }
        FS.truncate(stream.node, len);
      },
  utime(path, atime, mtime) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        node.node_ops.setattr(node, {
          timestamp: Math.max(atime, mtime)
        });
      },
  open(path, flags, mode) {
        if (path === "") {
          throw new FS.ErrnoError(44);
        }
        flags = typeof flags == 'string' ? FS_modeStringToFlags(flags) : flags;
        mode = typeof mode == 'undefined' ? 438 /* 0666 */ : mode;
        if ((flags & 64)) {
          mode = (mode & 4095) | 32768;
        } else {
          mode = 0;
        }
        var node;
        if (typeof path == 'object') {
          node = path;
        } else {
          path = PATH.normalize(path);
          try {
            var lookup = FS.lookupPath(path, {
              follow: !(flags & 131072)
            });
            node = lookup.node;
          } catch (e) {
            // ignore
          }
        }
        // perhaps we need to create the node
        var created = false;
        if ((flags & 64)) {
          if (node) {
            // if O_CREAT and O_EXCL are set, error out if the node already exists
            if ((flags & 128)) {
              throw new FS.ErrnoError(20);
            }
          } else {
            // node doesn't exist, try to create it
            node = FS.mknod(path, mode, 0);
            created = true;
          }
        }
        if (!node) {
          throw new FS.ErrnoError(44);
        }
        // can't truncate a device
        if (FS.isChrdev(node.mode)) {
          flags &= ~512;
        }
        // if asked only for a directory, then this must be one
        if ((flags & 65536) && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(54);
        }
        // check permissions, if this is not a file we just created now (it is ok to
        // create and write to a file with read-only permissions; it is read-only
        // for later use)
        if (!created) {
          var errCode = FS.mayOpen(node, flags);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
        }
        // do truncation if necessary
        if ((flags & 512) && !created) {
          FS.truncate(node, 0);
        }
        // we've already handled these, don't pass down to the underlying vfs
        flags &= ~(128 | 512 | 131072);
  
        // register the stream with the filesystem
        var stream = FS.createStream({
          node,
          path: FS.getPath(node),  // we want the absolute path to the node
          flags,
          seekable: true,
          position: 0,
          stream_ops: node.stream_ops,
          // used by the file family libc calls (fopen, fwrite, ferror, etc.)
          ungotten: [],
          error: false
        });
        // call the new stream's open function
        if (stream.stream_ops.open) {
          stream.stream_ops.open(stream);
        }
        if (Module['logReadFiles'] && !(flags & 1)) {
          if (!FS.readFiles) FS.readFiles = {};
          if (!(path in FS.readFiles)) {
            FS.readFiles[path] = 1;
          }
        }
        return stream;
      },
  close(stream) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (stream.getdents) stream.getdents = null; // free readdir state
        try {
          if (stream.stream_ops.close) {
            stream.stream_ops.close(stream);
          }
        } catch (e) {
          throw e;
        } finally {
          FS.closeStream(stream.fd);
        }
        stream.fd = null;
      },
  isClosed(stream) {
        return stream.fd === null;
      },
  llseek(stream, offset, whence) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (!stream.seekable || !stream.stream_ops.llseek) {
          throw new FS.ErrnoError(70);
        }
        if (whence != 0 && whence != 1 && whence != 2) {
          throw new FS.ErrnoError(28);
        }
        stream.position = stream.stream_ops.llseek(stream, offset, whence);
        stream.ungotten = [];
        return stream.position;
      },
  read(stream, buffer, offset, length, position) {
        assert(offset >= 0);
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(28);
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(8);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!stream.stream_ops.read) {
          throw new FS.ErrnoError(28);
        }
        var seeking = typeof position != 'undefined';
        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(70);
        }
        var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
        if (!seeking) stream.position += bytesRead;
        return bytesRead;
      },
  write(stream, buffer, offset, length, position, canOwn) {
        assert(offset >= 0);
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(28);
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(8);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!stream.stream_ops.write) {
          throw new FS.ErrnoError(28);
        }
        if (stream.seekable && stream.flags & 1024) {
          // seek to the end before writing in append mode
          FS.llseek(stream, 0, 2);
        }
        var seeking = typeof position != 'undefined';
        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(70);
        }
        var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
        if (!seeking) stream.position += bytesWritten;
        return bytesWritten;
      },
  allocate(stream, offset, length) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (offset < 0 || length <= 0) {
          throw new FS.ErrnoError(28);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(8);
        }
        if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(43);
        }
        if (!stream.stream_ops.allocate) {
          throw new FS.ErrnoError(138);
        }
        stream.stream_ops.allocate(stream, offset, length);
      },
  mmap(stream, length, position, prot, flags) {
        // User requests writing to file (prot & PROT_WRITE != 0).
        // Checking if we have permissions to write to the file unless
        // MAP_PRIVATE flag is set. According to POSIX spec it is possible
        // to write to file opened in read-only mode with MAP_PRIVATE flag,
        // as all modifications will be visible only in the memory of
        // the current process.
        if ((prot & 2) !== 0
            && (flags & 2) === 0
            && (stream.flags & 2097155) !== 2) {
          throw new FS.ErrnoError(2);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(2);
        }
        if (!stream.stream_ops.mmap) {
          throw new FS.ErrnoError(43);
        }
        return stream.stream_ops.mmap(stream, length, position, prot, flags);
      },
  msync(stream, buffer, offset, length, mmapFlags) {
        assert(offset >= 0);
        if (!stream.stream_ops.msync) {
          return 0;
        }
        return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
      },
  munmap:(stream) => 0,
  ioctl(stream, cmd, arg) {
        if (!stream.stream_ops.ioctl) {
          throw new FS.ErrnoError(59);
        }
        return stream.stream_ops.ioctl(stream, cmd, arg);
      },
  readFile(path, opts = {}) {
        opts.flags = opts.flags || 0;
        opts.encoding = opts.encoding || 'binary';
        if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
          throw new Error(`Invalid encoding type "${opts.encoding}"`);
        }
        var ret;
        var stream = FS.open(path, opts.flags);
        var stat = FS.stat(path);
        var length = stat.size;
        var buf = new Uint8Array(length);
        FS.read(stream, buf, 0, length, 0);
        if (opts.encoding === 'utf8') {
          ret = UTF8ArrayToString(buf, 0);
        } else if (opts.encoding === 'binary') {
          ret = buf;
        }
        FS.close(stream);
        return ret;
      },
  writeFile(path, data, opts = {}) {
        opts.flags = opts.flags || 577;
        var stream = FS.open(path, opts.flags, opts.mode);
        if (typeof data == 'string') {
          var buf = new Uint8Array(lengthBytesUTF8(data)+1);
          var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
          FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn);
        } else if (ArrayBuffer.isView(data)) {
          FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
        } else {
          throw new Error('Unsupported data type');
        }
        FS.close(stream);
      },
  cwd:() => FS.currentPath,
  chdir(path) {
        var lookup = FS.lookupPath(path, { follow: true });
        if (lookup.node === null) {
          throw new FS.ErrnoError(44);
        }
        if (!FS.isDir(lookup.node.mode)) {
          throw new FS.ErrnoError(54);
        }
        var errCode = FS.nodePermissions(lookup.node, 'x');
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        FS.currentPath = lookup.path;
      },
  createDefaultDirectories() {
        FS.mkdir('/tmp');
        FS.mkdir('/home');
        FS.mkdir('/home/web_user');
      },
  createDefaultDevices() {
        // create /dev
        FS.mkdir('/dev');
        // setup /dev/null
        FS.registerDevice(FS.makedev(1, 3), {
          read: () => 0,
          write: (stream, buffer, offset, length, pos) => length,
        });
        FS.mkdev('/dev/null', FS.makedev(1, 3));
        // setup /dev/tty and /dev/tty1
        // stderr needs to print output using err() rather than out()
        // so we register a second tty just for it.
        TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
        TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
        FS.mkdev('/dev/tty', FS.makedev(5, 0));
        FS.mkdev('/dev/tty1', FS.makedev(6, 0));
        // setup /dev/[u]random
        // use a buffer to avoid overhead of individual crypto calls per byte
        var randomBuffer = new Uint8Array(1024), randomLeft = 0;
        var randomByte = () => {
          if (randomLeft === 0) {
            randomLeft = randomFill(randomBuffer).byteLength;
          }
          return randomBuffer[--randomLeft];
        };
        FS.createDevice('/dev', 'random', randomByte);
        FS.createDevice('/dev', 'urandom', randomByte);
        // we're not going to emulate the actual shm device,
        // just create the tmp dirs that reside in it commonly
        FS.mkdir('/dev/shm');
        FS.mkdir('/dev/shm/tmp');
      },
  createSpecialDirectories() {
        // create /proc/self/fd which allows /proc/self/fd/6 => readlink gives the
        // name of the stream for fd 6 (see test_unistd_ttyname)
        FS.mkdir('/proc');
        var proc_self = FS.mkdir('/proc/self');
        FS.mkdir('/proc/self/fd');
        FS.mount({
          mount() {
            var node = FS.createNode(proc_self, 'fd', 16384 | 511 /* 0777 */, 73);
            node.node_ops = {
              lookup(parent, name) {
                var fd = +name;
                var stream = FS.getStreamChecked(fd);
                var ret = {
                  parent: null,
                  mount: { mountpoint: 'fake' },
                  node_ops: { readlink: () => stream.path },
                };
                ret.parent = ret; // make it look like a simple root node
                return ret;
              }
            };
            return node;
          }
        }, {}, '/proc/self/fd');
      },
  createStandardStreams() {
        // TODO deprecate the old functionality of a single
        // input / output callback and that utilizes FS.createDevice
        // and instead require a unique set of stream ops
  
        // by default, we symlink the standard streams to the
        // default tty devices. however, if the standard streams
        // have been overwritten we create a unique device for
        // them instead.
        if (Module['stdin']) {
          FS.createDevice('/dev', 'stdin', Module['stdin']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdin');
        }
        if (Module['stdout']) {
          FS.createDevice('/dev', 'stdout', null, Module['stdout']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdout');
        }
        if (Module['stderr']) {
          FS.createDevice('/dev', 'stderr', null, Module['stderr']);
        } else {
          FS.symlink('/dev/tty1', '/dev/stderr');
        }
  
        // open default streams for the stdin, stdout and stderr devices
        var stdin = FS.open('/dev/stdin', 0);
        var stdout = FS.open('/dev/stdout', 1);
        var stderr = FS.open('/dev/stderr', 1);
        assert(stdin.fd === 0, `invalid handle for stdin (${stdin.fd})`);
        assert(stdout.fd === 1, `invalid handle for stdout (${stdout.fd})`);
        assert(stderr.fd === 2, `invalid handle for stderr (${stderr.fd})`);
      },
  ensureErrnoError() {
        if (FS.ErrnoError) return;
        FS.ErrnoError = /** @this{Object} */ function ErrnoError(errno, node) {
          // We set the `name` property to be able to identify `FS.ErrnoError`
          // - the `name` is a standard ECMA-262 property of error objects. Kind of good to have it anyway.
          // - when using PROXYFS, an error can come from an underlying FS
          // as different FS objects have their own FS.ErrnoError each,
          // the test `err instanceof FS.ErrnoError` won't detect an error coming from another filesystem, causing bugs.
          // we'll use the reliable test `err.name == "ErrnoError"` instead
          this.name = 'ErrnoError';
          this.node = node;
          this.setErrno = /** @this{Object} */ function(errno) {
            this.errno = errno;
            for (var key in ERRNO_CODES) {
              if (ERRNO_CODES[key] === errno) {
                this.code = key;
                break;
              }
            }
          };
          this.setErrno(errno);
          this.message = ERRNO_MESSAGES[errno];
  
          // Try to get a maximally helpful stack trace. On Node.js, getting Error.stack
          // now ensures it shows what we want.
          if (this.stack) {
            // Define the stack property for Node.js 4, which otherwise errors on the next line.
            Object.defineProperty(this, "stack", { value: (new Error).stack, writable: true });
            this.stack = demangleAll(this.stack);
          }
        };
        FS.ErrnoError.prototype = new Error();
        FS.ErrnoError.prototype.constructor = FS.ErrnoError;
        // Some errors may happen quite a bit, to avoid overhead we reuse them (and suffer a lack of stack info)
        [44].forEach((code) => {
          FS.genericErrors[code] = new FS.ErrnoError(code);
          FS.genericErrors[code].stack = '<generic error, no stack>';
        });
      },
  staticInit() {
        FS.ensureErrnoError();
  
        FS.nameTable = new Array(4096);
  
        FS.mount(MEMFS, {}, '/');
  
        FS.createDefaultDirectories();
        FS.createDefaultDevices();
        FS.createSpecialDirectories();
  
        FS.filesystems = {
          'MEMFS': MEMFS,
        };
      },
  init(input, output, error) {
        assert(!FS.init.initialized, 'FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)');
        FS.init.initialized = true;
  
        FS.ensureErrnoError();
  
        // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
        Module['stdin'] = input || Module['stdin'];
        Module['stdout'] = output || Module['stdout'];
        Module['stderr'] = error || Module['stderr'];
  
        FS.createStandardStreams();
      },
  quit() {
        FS.init.initialized = false;
        // force-flush all streams, so we get musl std streams printed out
        _fflush(0);
        // close all of our streams
        for (var i = 0; i < FS.streams.length; i++) {
          var stream = FS.streams[i];
          if (!stream) {
            continue;
          }
          FS.close(stream);
        }
      },
  findObject(path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (!ret.exists) {
          return null;
        }
        return ret.object;
      },
  analyzePath(path, dontResolveLastLink) {
        // operate from within the context of the symlink's target
        try {
          var lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          path = lookup.path;
        } catch (e) {
        }
        var ret = {
          isRoot: false, exists: false, error: 0, name: null, path: null, object: null,
          parentExists: false, parentPath: null, parentObject: null
        };
        try {
          var lookup = FS.lookupPath(path, { parent: true });
          ret.parentExists = true;
          ret.parentPath = lookup.path;
          ret.parentObject = lookup.node;
          ret.name = PATH.basename(path);
          lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          ret.exists = true;
          ret.path = lookup.path;
          ret.object = lookup.node;
          ret.name = lookup.node.name;
          ret.isRoot = lookup.path === '/';
        } catch (e) {
          ret.error = e.errno;
        };
        return ret;
      },
  createPath(parent, path, canRead, canWrite) {
        parent = typeof parent == 'string' ? parent : FS.getPath(parent);
        var parts = path.split('/').reverse();
        while (parts.length) {
          var part = parts.pop();
          if (!part) continue;
          var current = PATH.join2(parent, part);
          try {
            FS.mkdir(current);
          } catch (e) {
            // ignore EEXIST
          }
          parent = current;
        }
        return current;
      },
  createFile(parent, name, properties, canRead, canWrite) {
        var path = PATH.join2(typeof parent == 'string' ? parent : FS.getPath(parent), name);
        var mode = FS_getMode(canRead, canWrite);
        return FS.create(path, mode);
      },
  createDataFile(parent, name, data, canRead, canWrite, canOwn) {
        var path = name;
        if (parent) {
          parent = typeof parent == 'string' ? parent : FS.getPath(parent);
          path = name ? PATH.join2(parent, name) : parent;
        }
        var mode = FS_getMode(canRead, canWrite);
        var node = FS.create(path, mode);
        if (data) {
          if (typeof data == 'string') {
            var arr = new Array(data.length);
            for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
            data = arr;
          }
          // make sure we can write to the file
          FS.chmod(node, mode | 146);
          var stream = FS.open(node, 577);
          FS.write(stream, data, 0, data.length, 0, canOwn);
          FS.close(stream);
          FS.chmod(node, mode);
        }
      },
  createDevice(parent, name, input, output) {
        var path = PATH.join2(typeof parent == 'string' ? parent : FS.getPath(parent), name);
        var mode = FS_getMode(!!input, !!output);
        if (!FS.createDevice.major) FS.createDevice.major = 64;
        var dev = FS.makedev(FS.createDevice.major++, 0);
        // Create a fake device that a set of stream ops to emulate
        // the old behavior.
        FS.registerDevice(dev, {
          open(stream) {
            stream.seekable = false;
          },
          close(stream) {
            // flush any pending line data
            if (output && output.buffer && output.buffer.length) {
              output(10);
            }
          },
          read(stream, buffer, offset, length, pos /* ignored */) {
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
              var result;
              try {
                result = input();
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
              if (result === undefined && bytesRead === 0) {
                throw new FS.ErrnoError(6);
              }
              if (result === null || result === undefined) break;
              bytesRead++;
              buffer[offset+i] = result;
            }
            if (bytesRead) {
              stream.node.timestamp = Date.now();
            }
            return bytesRead;
          },
          write(stream, buffer, offset, length, pos) {
            for (var i = 0; i < length; i++) {
              try {
                output(buffer[offset+i]);
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
            }
            if (length) {
              stream.node.timestamp = Date.now();
            }
            return i;
          }
        });
        return FS.mkdev(path, mode, dev);
      },
  forceLoadFile(obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
        if (typeof XMLHttpRequest != 'undefined') {
          throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
        } else if (read_) {
          // Command-line.
          try {
            // WARNING: Can't read binary files in V8's d8 or tracemonkey's js, as
            //          read() will try to parse UTF8.
            obj.contents = intArrayFromString(read_(obj.url), true);
            obj.usedBytes = obj.contents.length;
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
        } else {
          throw new Error('Cannot load without read() or XMLHttpRequest.');
        }
      },
  createLazyFile(parent, name, url, canRead, canWrite) {
        // Lazy chunked Uint8Array (implements get and length from Uint8Array). Actual getting is abstracted away for eventual reuse.
        /** @constructor */
        function LazyUint8Array() {
          this.lengthKnown = false;
          this.chunks = []; // Loaded chunks. Index is the chunk number
        }
        LazyUint8Array.prototype.get = /** @this{Object} */ function LazyUint8Array_get(idx) {
          if (idx > this.length-1 || idx < 0) {
            return undefined;
          }
          var chunkOffset = idx % this.chunkSize;
          var chunkNum = (idx / this.chunkSize)|0;
          return this.getter(chunkNum)[chunkOffset];
        };
        LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
          this.getter = getter;
        };
        LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
          // Find length
          var xhr = new XMLHttpRequest();
          xhr.open('HEAD', url, false);
          xhr.send(null);
          if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
          var datalength = Number(xhr.getResponseHeader("Content-length"));
          var header;
          var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
          var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
  
          var chunkSize = 1024*1024; // Chunk size in bytes
  
          if (!hasByteServing) chunkSize = datalength;
  
          // Function to get a range from the remote URL.
          var doXHR = (from, to) => {
            if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
            if (to > datalength-1) throw new Error("only " + datalength + " bytes available! programmer error!");
  
            // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false);
            if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
  
            // Some hints to the browser that we want binary data.
            xhr.responseType = 'arraybuffer';
            if (xhr.overrideMimeType) {
              xhr.overrideMimeType('text/plain; charset=x-user-defined');
            }
  
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
            if (xhr.response !== undefined) {
              return new Uint8Array(/** @type{Array<number>} */(xhr.response || []));
            }
            return intArrayFromString(xhr.responseText || '', true);
          };
          var lazyArray = this;
          lazyArray.setDataGetter((chunkNum) => {
            var start = chunkNum * chunkSize;
            var end = (chunkNum+1) * chunkSize - 1; // including this byte
            end = Math.min(end, datalength-1); // if datalength-1 is selected, this is the last block
            if (typeof lazyArray.chunks[chunkNum] == 'undefined') {
              lazyArray.chunks[chunkNum] = doXHR(start, end);
            }
            if (typeof lazyArray.chunks[chunkNum] == 'undefined') throw new Error('doXHR failed!');
            return lazyArray.chunks[chunkNum];
          });
  
          if (usesGzip || !datalength) {
            // if the server uses gzip or doesn't supply the length, we have to download the whole file to get the (uncompressed) length
            chunkSize = datalength = 1; // this will force getter(0)/doXHR do download the whole file
            datalength = this.getter(0).length;
            chunkSize = datalength;
            out("LazyFiles on gzip forces download of the whole file when length is accessed");
          }
  
          this._length = datalength;
          this._chunkSize = chunkSize;
          this.lengthKnown = true;
        };
        if (typeof XMLHttpRequest != 'undefined') {
          if (!ENVIRONMENT_IS_WORKER) throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc';
          var lazyArray = new LazyUint8Array();
          Object.defineProperties(lazyArray, {
            length: {
              get: /** @this{Object} */ function() {
                if (!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._length;
              }
            },
            chunkSize: {
              get: /** @this{Object} */ function() {
                if (!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._chunkSize;
              }
            }
          });
  
          var properties = { isDevice: false, contents: lazyArray };
        } else {
          var properties = { isDevice: false, url: url };
        }
  
        var node = FS.createFile(parent, name, properties, canRead, canWrite);
        // This is a total hack, but I want to get this lazy file code out of the
        // core of MEMFS. If we want to keep this lazy file concept I feel it should
        // be its own thin LAZYFS proxying calls to MEMFS.
        if (properties.contents) {
          node.contents = properties.contents;
        } else if (properties.url) {
          node.contents = null;
          node.url = properties.url;
        }
        // Add a function that defers querying the file size until it is asked the first time.
        Object.defineProperties(node, {
          usedBytes: {
            get: /** @this {FSNode} */ function() { return this.contents.length; }
          }
        });
        // override each stream op with one that tries to force load the lazy file first
        var stream_ops = {};
        var keys = Object.keys(node.stream_ops);
        keys.forEach((key) => {
          var fn = node.stream_ops[key];
          stream_ops[key] = function forceLoadLazyFile() {
            FS.forceLoadFile(node);
            return fn.apply(null, arguments);
          };
        });
        function writeChunks(stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= contents.length)
            return 0;
          var size = Math.min(contents.length - position, length);
          assert(size >= 0);
          if (contents.slice) { // normal array
            for (var i = 0; i < size; i++) {
              buffer[offset + i] = contents[position + i];
            }
          } else {
            for (var i = 0; i < size; i++) { // LazyUint8Array from sync binary XHR
              buffer[offset + i] = contents.get(position + i);
            }
          }
          return size;
        }
        // use a custom read function
        stream_ops.read = (stream, buffer, offset, length, position) => {
          FS.forceLoadFile(node);
          return writeChunks(stream, buffer, offset, length, position)
        };
        // use a custom mmap function
        stream_ops.mmap = (stream, length, position, prot, flags) => {
          FS.forceLoadFile(node);
          var ptr = mmapAlloc(length);
          if (!ptr) {
            throw new FS.ErrnoError(48);
          }
          writeChunks(stream, HEAP8, ptr, length, position);
          return { ptr, allocated: true };
        };
        node.stream_ops = stream_ops;
        return node;
      },
  absolutePath() {
        abort('FS.absolutePath has been removed; use PATH_FS.resolve instead');
      },
  createFolder() {
        abort('FS.createFolder has been removed; use FS.mkdir instead');
      },
  createLink() {
        abort('FS.createLink has been removed; use FS.symlink instead');
      },
  joinPath() {
        abort('FS.joinPath has been removed; use PATH.join instead');
      },
  mmapAlloc() {
        abort('FS.mmapAlloc has been replaced by the top level function mmapAlloc');
      },
  standardizePath() {
        abort('FS.standardizePath has been removed; use PATH.normalize instead');
      },
  };
  
  
    /**
     * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
     * emscripten HEAP, returns a copy of that string as a Javascript String object.
     *
     * @param {number} ptr
     * @param {number=} maxBytesToRead - An optional length that specifies the
     *   maximum number of bytes to read. You can omit this parameter to scan the
     *   string until the first 0 byte. If maxBytesToRead is passed, and the string
     *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
     *   string will cut short at that byte index (i.e. maxBytesToRead will not
     *   produce a string of exact length [ptr, ptr+maxBytesToRead[) N.B. mixing
     *   frequent uses of UTF8ToString() with and without maxBytesToRead may throw
     *   JS JIT optimizations off, so it is worth to consider consistently using one
     * @return {string}
     */
  var UTF8ToString = (ptr, maxBytesToRead) => {
      assert(typeof ptr == 'number', `UTF8ToString expects a number (got ${typeof ptr})`);
      return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
    };
  var SYSCALLS = {
  DEFAULT_POLLMASK:5,
  calculateAt(dirfd, path, allowEmpty) {
        if (PATH.isAbs(path)) {
          return path;
        }
        // relative path
        var dir;
        if (dirfd === -100) {
          dir = FS.cwd();
        } else {
          var dirstream = SYSCALLS.getStreamFromFD(dirfd);
          dir = dirstream.path;
        }
        if (path.length == 0) {
          if (!allowEmpty) {
            throw new FS.ErrnoError(44);;
          }
          return dir;
        }
        return PATH.join2(dir, path);
      },
  doStat(func, path, buf) {
        try {
          var stat = func(path);
        } catch (e) {
          if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
            // an error occurred while trying to look up the path; we should just report ENOTDIR
            return -54;
          }
          throw e;
        }
        HEAP32[((buf)>>2)] = stat.dev;
        HEAP32[(((buf)+(4))>>2)] = stat.mode;
        HEAPU32[(((buf)+(8))>>2)] = stat.nlink;
        HEAP32[(((buf)+(12))>>2)] = stat.uid;
        HEAP32[(((buf)+(16))>>2)] = stat.gid;
        HEAP32[(((buf)+(20))>>2)] = stat.rdev;
        (tempI64 = [stat.size>>>0,(tempDouble = stat.size,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(24))>>2)] = tempI64[0],HEAP32[(((buf)+(28))>>2)] = tempI64[1]);
        HEAP32[(((buf)+(32))>>2)] = 4096;
        HEAP32[(((buf)+(36))>>2)] = stat.blocks;
        var atime = stat.atime.getTime();
        var mtime = stat.mtime.getTime();
        var ctime = stat.ctime.getTime();
        (tempI64 = [Math.floor(atime / 1000)>>>0,(tempDouble = Math.floor(atime / 1000),(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(40))>>2)] = tempI64[0],HEAP32[(((buf)+(44))>>2)] = tempI64[1]);
        HEAPU32[(((buf)+(48))>>2)] = (atime % 1000) * 1000;
        (tempI64 = [Math.floor(mtime / 1000)>>>0,(tempDouble = Math.floor(mtime / 1000),(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(56))>>2)] = tempI64[0],HEAP32[(((buf)+(60))>>2)] = tempI64[1]);
        HEAPU32[(((buf)+(64))>>2)] = (mtime % 1000) * 1000;
        (tempI64 = [Math.floor(ctime / 1000)>>>0,(tempDouble = Math.floor(ctime / 1000),(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(72))>>2)] = tempI64[0],HEAP32[(((buf)+(76))>>2)] = tempI64[1]);
        HEAPU32[(((buf)+(80))>>2)] = (ctime % 1000) * 1000;
        (tempI64 = [stat.ino>>>0,(tempDouble = stat.ino,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(88))>>2)] = tempI64[0],HEAP32[(((buf)+(92))>>2)] = tempI64[1]);
        return 0;
      },
  doMsync(addr, stream, len, flags, offset) {
        if (!FS.isFile(stream.node.mode)) {
          throw new FS.ErrnoError(43);
        }
        if (flags & 2) {
          // MAP_PRIVATE calls need not to be synced back to underlying fs
          return 0;
        }
        var buffer = HEAPU8.slice(addr, addr + len);
        FS.msync(stream, buffer, offset, len, flags);
      },
  varargs:undefined,
  get() {
        assert(SYSCALLS.varargs != undefined);
        // the `+` prepended here is necessary to convince the JSCompiler that varargs is indeed a number.
        var ret = HEAP32[((+SYSCALLS.varargs)>>2)];
        SYSCALLS.varargs += 4;
        return ret;
      },
  getp() { return SYSCALLS.get() },
  getStr(ptr) {
        var ret = UTF8ToString(ptr);
        return ret;
      },
  getStreamFromFD(fd) {
        var stream = FS.getStreamChecked(fd);
        return stream;
      },
  };
  function ___syscall_fcntl64(fd, cmd, varargs) {
  SYSCALLS.varargs = varargs;
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      switch (cmd) {
        case 0: {
          var arg = SYSCALLS.get();
          if (arg < 0) {
            return -28;
          }
          while (FS.streams[arg]) {
            arg++;
          }
          var newStream;
          newStream = FS.createStream(stream, arg);
          return newStream.fd;
        }
        case 1:
        case 2:
          return 0;  // FD_CLOEXEC makes no sense for a single process.
        case 3:
          return stream.flags;
        case 4: {
          var arg = SYSCALLS.get();
          stream.flags |= arg;
          return 0;
        }
        case 5: {
          var arg = SYSCALLS.getp();
          var offset = 0;
          // We're always unlocked.
          HEAP16[(((arg)+(offset))>>1)] = 2;
          return 0;
        }
        case 6:
        case 7:
          return 0; // Pretend that the locking is successful.
        case 16:
        case 8:
          return -28; // These are for sockets. We don't have them fully implemented yet.
        case 9:
          // musl trusts getown return values, due to a bug where they must be, as they overlap with errors. just return -1 here, so fcntl() returns that, and we set errno ourselves.
          setErrNo(28);
          return -1;
        default: {
          return -28;
        }
      }
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  function ___syscall_fstat64(fd, buf) {
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      return SYSCALLS.doStat(FS.stat, stream.path, buf);
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  function ___syscall_ioctl(fd, op, varargs) {
  SYSCALLS.varargs = varargs;
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      switch (op) {
        case 21509: {
          if (!stream.tty) return -59;
          return 0;
        }
        case 21505: {
          if (!stream.tty) return -59;
          if (stream.tty.ops.ioctl_tcgets) {
            var termios = stream.tty.ops.ioctl_tcgets(stream);
            var argp = SYSCALLS.getp();
            HEAP32[((argp)>>2)] = termios.c_iflag || 0;
            HEAP32[(((argp)+(4))>>2)] = termios.c_oflag || 0;
            HEAP32[(((argp)+(8))>>2)] = termios.c_cflag || 0;
            HEAP32[(((argp)+(12))>>2)] = termios.c_lflag || 0;
            for (var i = 0; i < 32; i++) {
              HEAP8[(((argp + i)+(17))>>0)] = termios.c_cc[i] || 0;
            }
            return 0;
          }
          return 0;
        }
        case 21510:
        case 21511:
        case 21512: {
          if (!stream.tty) return -59;
          return 0; // no-op, not actually adjusting terminal settings
        }
        case 21506:
        case 21507:
        case 21508: {
          if (!stream.tty) return -59;
          if (stream.tty.ops.ioctl_tcsets) {
            var argp = SYSCALLS.getp();
            var c_iflag = HEAP32[((argp)>>2)];
            var c_oflag = HEAP32[(((argp)+(4))>>2)];
            var c_cflag = HEAP32[(((argp)+(8))>>2)];
            var c_lflag = HEAP32[(((argp)+(12))>>2)];
            var c_cc = []
            for (var i = 0; i < 32; i++) {
              c_cc.push(HEAP8[(((argp + i)+(17))>>0)]);
            }
            return stream.tty.ops.ioctl_tcsets(stream.tty, op, { c_iflag, c_oflag, c_cflag, c_lflag, c_cc });
          }
          return 0; // no-op, not actually adjusting terminal settings
        }
        case 21519: {
          if (!stream.tty) return -59;
          var argp = SYSCALLS.getp();
          HEAP32[((argp)>>2)] = 0;
          return 0;
        }
        case 21520: {
          if (!stream.tty) return -59;
          return -28; // not supported
        }
        case 21531: {
          var argp = SYSCALLS.getp();
          return FS.ioctl(stream, op, argp);
        }
        case 21523: {
          // TODO: in theory we should write to the winsize struct that gets
          // passed in, but for now musl doesn't read anything on it
          if (!stream.tty) return -59;
          if (stream.tty.ops.ioctl_tiocgwinsz) {
            var winsize = stream.tty.ops.ioctl_tiocgwinsz(stream.tty);
            var argp = SYSCALLS.getp();
            HEAP16[((argp)>>1)] = winsize[0];
            HEAP16[(((argp)+(2))>>1)] = winsize[1];
          }
          return 0;
        }
        case 21524: {
          // TODO: technically, this ioctl call should change the window size.
          // but, since emscripten doesn't have any concept of a terminal window
          // yet, we'll just silently throw it away as we do TIOCGWINSZ
          if (!stream.tty) return -59;
          return 0;
        }
        case 21515: {
          if (!stream.tty) return -59;
          return 0;
        }
        default: return -28; // not supported
      }
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  function ___syscall_lstat64(path, buf) {
  try {
  
      path = SYSCALLS.getStr(path);
      return SYSCALLS.doStat(FS.lstat, path, buf);
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  function ___syscall_newfstatat(dirfd, path, buf, flags) {
  try {
  
      path = SYSCALLS.getStr(path);
      var nofollow = flags & 256;
      var allowEmpty = flags & 4096;
      flags = flags & (~6400);
      assert(!flags, `unknown flags in __syscall_newfstatat: ${flags}`);
      path = SYSCALLS.calculateAt(dirfd, path, allowEmpty);
      return SYSCALLS.doStat(nofollow ? FS.lstat : FS.stat, path, buf);
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  function ___syscall_openat(dirfd, path, flags, varargs) {
  SYSCALLS.varargs = varargs;
  try {
  
      path = SYSCALLS.getStr(path);
      path = SYSCALLS.calculateAt(dirfd, path);
      var mode = varargs ? SYSCALLS.get() : 0;
      return FS.open(path, flags, mode).fd;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  function ___syscall_stat64(path, buf) {
  try {
  
      path = SYSCALLS.getStr(path);
      return SYSCALLS.doStat(FS.stat, path, buf);
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  var __embind_register_bigint = (primitiveType, name, size, minRange, maxRange) => {};

  var embind_init_charCodes = () => {
      var codes = new Array(256);
      for (var i = 0; i < 256; ++i) {
          codes[i] = String.fromCharCode(i);
      }
      embind_charCodes = codes;
    };
  var embind_charCodes;
  var readLatin1String = (ptr) => {
      var ret = "";
      var c = ptr;
      while (HEAPU8[c]) {
          ret += embind_charCodes[HEAPU8[c++]];
      }
      return ret;
    };
  
  var awaitingDependencies = {
  };
  
  var registeredTypes = {
  };
  
  var typeDependencies = {
  };
  
  var BindingError;
  var throwBindingError = (message) => { throw new BindingError(message); };
  
  
  
  
  var InternalError;
  var throwInternalError = (message) => { throw new InternalError(message); };
  var whenDependentTypesAreResolved = (myTypes, dependentTypes, getTypeConverters) => {
      myTypes.forEach(function(type) {
          typeDependencies[type] = dependentTypes;
      });
  
      function onComplete(typeConverters) {
          var myTypeConverters = getTypeConverters(typeConverters);
          if (myTypeConverters.length !== myTypes.length) {
              throwInternalError('Mismatched type converter count');
          }
          for (var i = 0; i < myTypes.length; ++i) {
              registerType(myTypes[i], myTypeConverters[i]);
          }
      }
  
      var typeConverters = new Array(dependentTypes.length);
      var unregisteredTypes = [];
      var registered = 0;
      dependentTypes.forEach((dt, i) => {
        if (registeredTypes.hasOwnProperty(dt)) {
          typeConverters[i] = registeredTypes[dt];
        } else {
          unregisteredTypes.push(dt);
          if (!awaitingDependencies.hasOwnProperty(dt)) {
            awaitingDependencies[dt] = [];
          }
          awaitingDependencies[dt].push(() => {
            typeConverters[i] = registeredTypes[dt];
            ++registered;
            if (registered === unregisteredTypes.length) {
              onComplete(typeConverters);
            }
          });
        }
      });
      if (0 === unregisteredTypes.length) {
        onComplete(typeConverters);
      }
    };
  /** @param {Object=} options */
  function sharedRegisterType(rawType, registeredInstance, options = {}) {
      var name = registeredInstance.name;
      if (!rawType) {
        throwBindingError(`type "${name}" must have a positive integer typeid pointer`);
      }
      if (registeredTypes.hasOwnProperty(rawType)) {
        if (options.ignoreDuplicateRegistrations) {
          return;
        } else {
          throwBindingError(`Cannot register type '${name}' twice`);
        }
      }
  
      registeredTypes[rawType] = registeredInstance;
      delete typeDependencies[rawType];
  
      if (awaitingDependencies.hasOwnProperty(rawType)) {
        var callbacks = awaitingDependencies[rawType];
        delete awaitingDependencies[rawType];
        callbacks.forEach((cb) => cb());
      }
    }
  /** @param {Object=} options */
  function registerType(rawType, registeredInstance, options = {}) {
      if (!('argPackAdvance' in registeredInstance)) {
        throw new TypeError('registerType registeredInstance requires argPackAdvance');
      }
      return sharedRegisterType(rawType, registeredInstance, options);
    }
  
  var GenericWireTypeSize = 8;
  /** @suppress {globalThis} */
  var __embind_register_bool = (rawType, name, trueValue, falseValue) => {
      name = readLatin1String(name);
      registerType(rawType, {
          name,
          'fromWireType': function(wt) {
              // ambiguous emscripten ABI: sometimes return values are
              // true or false, and sometimes integers (0 or 1)
              return !!wt;
          },
          'toWireType': function(destructors, o) {
              return o ? trueValue : falseValue;
          },
          'argPackAdvance': GenericWireTypeSize,
          'readValueFromPointer': function(pointer) {
              return this['fromWireType'](HEAPU8[pointer]);
          },
          destructorFunction: null, // This type does not need a destructor
      });
    };

  function handleAllocatorInit() {
      Object.assign(HandleAllocator.prototype, /** @lends {HandleAllocator.prototype} */ {
        get(id) {
          assert(this.allocated[id] !== undefined, `invalid handle: ${id}`);
          return this.allocated[id];
        },
        has(id) {
          return this.allocated[id] !== undefined;
        },
        allocate(handle) {
          var id = this.freelist.pop() || this.allocated.length;
          this.allocated[id] = handle;
          return id;
        },
        free(id) {
          assert(this.allocated[id] !== undefined);
          // Set the slot to `undefined` rather than using `delete` here since
          // apparently arrays with holes in them can be less efficient.
          this.allocated[id] = undefined;
          this.freelist.push(id);
        }
      });
    }
  /** @constructor */
  function HandleAllocator() {
      // Reserve slot 0 so that 0 is always an invalid handle
      this.allocated = [undefined];
      this.freelist = [];
    }
  var emval_handles = new HandleAllocator();;
  var __emval_decref = (handle) => {
      if (handle >= emval_handles.reserved && 0 === --emval_handles.get(handle).refcount) {
        emval_handles.free(handle);
      }
    };
  
  
  
  var count_emval_handles = () => {
      var count = 0;
      for (var i = emval_handles.reserved; i < emval_handles.allocated.length; ++i) {
        if (emval_handles.allocated[i] !== undefined) {
          ++count;
        }
      }
      return count;
    };
  
  var init_emval = () => {
      // reserve some special values. These never get de-allocated.
      // The HandleAllocator takes care of reserving zero.
      emval_handles.allocated.push(
        {value: undefined},
        {value: null},
        {value: true},
        {value: false},
      );
      emval_handles.reserved = emval_handles.allocated.length
      Module['count_emval_handles'] = count_emval_handles;
    };
  var Emval = {
  toValue:(handle) => {
        if (!handle) {
            throwBindingError('Cannot use deleted val. handle = ' + handle);
        }
        return emval_handles.get(handle).value;
      },
  toHandle:(value) => {
        switch (value) {
          case undefined: return 1;
          case null: return 2;
          case true: return 3;
          case false: return 4;
          default:{
            return emval_handles.allocate({refcount: 1, value: value});
          }
        }
      },
  };
  
  
  
  /** @suppress {globalThis} */
  function simpleReadValueFromPointer(pointer) {
      return this['fromWireType'](HEAP32[((pointer)>>2)]);
    }
  var __embind_register_emval = (rawType, name) => {
      name = readLatin1String(name);
      registerType(rawType, {
        name,
        'fromWireType': (handle) => {
          var rv = Emval.toValue(handle);
          __emval_decref(handle);
          return rv;
        },
        'toWireType': (destructors, value) => Emval.toHandle(value),
        'argPackAdvance': GenericWireTypeSize,
        'readValueFromPointer': simpleReadValueFromPointer,
        destructorFunction: null, // This type does not need a destructor
  
        // TODO: do we need a deleteObject here?  write a test where
        // emval is passed into JS via an interface
      });
    };

  var embindRepr = (v) => {
      if (v === null) {
          return 'null';
      }
      var t = typeof v;
      if (t === 'object' || t === 'array' || t === 'function') {
          return v.toString();
      } else {
          return '' + v;
      }
    };
  
  var floatReadValueFromPointer = (name, width) => {
      switch (width) {
          case 4: return function(pointer) {
              return this['fromWireType'](HEAPF32[((pointer)>>2)]);
          };
          case 8: return function(pointer) {
              return this['fromWireType'](HEAPF64[((pointer)>>3)]);
          };
          default:
              throw new TypeError(`invalid float width (${width}): ${name}`);
      }
    };
  
  
  var __embind_register_float = (rawType, name, size) => {
      name = readLatin1String(name);
      registerType(rawType, {
        name,
        'fromWireType': (value) => value,
        'toWireType': (destructors, value) => {
          if (typeof value != "number" && typeof value != "boolean") {
            throw new TypeError(`Cannot convert ${embindRepr(value)} to ${this.name}`);
          }
          // The VM will perform JS to Wasm value conversion, according to the spec:
          // https://www.w3.org/TR/wasm-js-api-1/#towebassemblyvalue
          return value;
        },
        'argPackAdvance': GenericWireTypeSize,
        'readValueFromPointer': floatReadValueFromPointer(name, size),
        destructorFunction: null, // This type does not need a destructor
      });
    };

  
  var integerReadValueFromPointer = (name, width, signed) => {
      // integers are quite common, so generate very specialized functions
      switch (width) {
          case 1: return signed ?
              (pointer) => HEAP8[((pointer)>>0)] :
              (pointer) => HEAPU8[((pointer)>>0)];
          case 2: return signed ?
              (pointer) => HEAP16[((pointer)>>1)] :
              (pointer) => HEAPU16[((pointer)>>1)]
          case 4: return signed ?
              (pointer) => HEAP32[((pointer)>>2)] :
              (pointer) => HEAPU32[((pointer)>>2)]
          default:
              throw new TypeError(`invalid integer width (${width}): ${name}`);
      }
    };
  
  
  /** @suppress {globalThis} */
  var __embind_register_integer = (primitiveType, name, size, minRange, maxRange) => {
      name = readLatin1String(name);
      // LLVM doesn't have signed and unsigned 32-bit types, so u32 literals come
      // out as 'i32 -1'. Always treat those as max u32.
      if (maxRange === -1) {
        maxRange = 4294967295;
      }
  
      var fromWireType = (value) => value;
  
      if (minRange === 0) {
        var bitshift = 32 - 8*size;
        fromWireType = (value) => (value << bitshift) >>> bitshift;
      }
  
      var isUnsignedType = (name.includes('unsigned'));
      var checkAssertions = (value, toTypeName) => {
        if (typeof value != "number" && typeof value != "boolean") {
          throw new TypeError(`Cannot convert "${embindRepr(value)}" to ${toTypeName}`);
        }
        if (value < minRange || value > maxRange) {
          throw new TypeError(`Passing a number "${embindRepr(value)}" from JS side to C/C++ side to an argument of type "${name}", which is outside the valid range [${minRange}, ${maxRange}]!`);
        }
      }
      var toWireType;
      if (isUnsignedType) {
        toWireType = function(destructors, value) {
          checkAssertions(value, this.name);
          return value >>> 0;
        }
      } else {
        toWireType = function(destructors, value) {
          checkAssertions(value, this.name);
          // The VM will perform JS to Wasm value conversion, according to the spec:
          // https://www.w3.org/TR/wasm-js-api-1/#towebassemblyvalue
          return value;
        }
      }
      registerType(primitiveType, {
        name,
        'fromWireType': fromWireType,
        'toWireType': toWireType,
        'argPackAdvance': GenericWireTypeSize,
        'readValueFromPointer': integerReadValueFromPointer(name, size, minRange !== 0),
        destructorFunction: null, // This type does not need a destructor
      });
    };

  
  var __embind_register_memory_view = (rawType, dataTypeIndex, name) => {
      var typeMapping = [
        Int8Array,
        Uint8Array,
        Int16Array,
        Uint16Array,
        Int32Array,
        Uint32Array,
        Float32Array,
        Float64Array,
      ];
  
      var TA = typeMapping[dataTypeIndex];
  
      function decodeMemoryView(handle) {
        var size = HEAPU32[((handle)>>2)];
        var data = HEAPU32[(((handle)+(4))>>2)];
        return new TA(HEAP8.buffer, data, size);
      }
  
      name = readLatin1String(name);
      registerType(rawType, {
        name,
        'fromWireType': decodeMemoryView,
        'argPackAdvance': GenericWireTypeSize,
        'readValueFromPointer': decodeMemoryView,
      }, {
        ignoreDuplicateRegistrations: true,
      });
    };

  
  
  /** @suppress {globalThis} */
  function readPointer(pointer) {
      return this['fromWireType'](HEAPU32[((pointer)>>2)]);
    }
  
  
  var stringToUTF8 = (str, outPtr, maxBytesToWrite) => {
      assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
      return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
    };
  
  
  
  
  var __embind_register_std_string = (rawType, name) => {
      name = readLatin1String(name);
      var stdStringIsUTF8
      //process only std::string bindings with UTF8 support, in contrast to e.g. std::basic_string<unsigned char>
      = (name === "std::string");
  
      registerType(rawType, {
        name,
        // For some method names we use string keys here since they are part of
        // the public/external API and/or used by the runtime-generated code.
        'fromWireType'(value) {
          var length = HEAPU32[((value)>>2)];
          var payload = value + 4;
  
          var str;
          if (stdStringIsUTF8) {
            var decodeStartPtr = payload;
            // Looping here to support possible embedded '0' bytes
            for (var i = 0; i <= length; ++i) {
              var currentBytePtr = payload + i;
              if (i == length || HEAPU8[currentBytePtr] == 0) {
                var maxRead = currentBytePtr - decodeStartPtr;
                var stringSegment = UTF8ToString(decodeStartPtr, maxRead);
                if (str === undefined) {
                  str = stringSegment;
                } else {
                  str += String.fromCharCode(0);
                  str += stringSegment;
                }
                decodeStartPtr = currentBytePtr + 1;
              }
            }
          } else {
            var a = new Array(length);
            for (var i = 0; i < length; ++i) {
              a[i] = String.fromCharCode(HEAPU8[payload + i]);
            }
            str = a.join('');
          }
  
          _free(value);
  
          return str;
        },
        'toWireType'(destructors, value) {
          if (value instanceof ArrayBuffer) {
            value = new Uint8Array(value);
          }
  
          var length;
          var valueIsOfTypeString = (typeof value == 'string');
  
          if (!(valueIsOfTypeString || value instanceof Uint8Array || value instanceof Uint8ClampedArray || value instanceof Int8Array)) {
            throwBindingError('Cannot pass non-string to std::string');
          }
          if (stdStringIsUTF8 && valueIsOfTypeString) {
            length = lengthBytesUTF8(value);
          } else {
            length = value.length;
          }
  
          // assumes 4-byte alignment
          var base = _malloc(4 + length + 1);
          var ptr = base + 4;
          HEAPU32[((base)>>2)] = length;
          if (stdStringIsUTF8 && valueIsOfTypeString) {
            stringToUTF8(value, ptr, length + 1);
          } else {
            if (valueIsOfTypeString) {
              for (var i = 0; i < length; ++i) {
                var charCode = value.charCodeAt(i);
                if (charCode > 255) {
                  _free(ptr);
                  throwBindingError('String has UTF-16 code units that do not fit in 8 bits');
                }
                HEAPU8[ptr + i] = charCode;
              }
            } else {
              for (var i = 0; i < length; ++i) {
                HEAPU8[ptr + i] = value[i];
              }
            }
          }
  
          if (destructors !== null) {
            destructors.push(_free, base);
          }
          return base;
        },
        'argPackAdvance': GenericWireTypeSize,
        'readValueFromPointer': readPointer,
        destructorFunction(ptr) {
          _free(ptr);
        },
      });
    };

  
  
  
  var UTF16Decoder = typeof TextDecoder != 'undefined' ? new TextDecoder('utf-16le') : undefined;;
  var UTF16ToString = (ptr, maxBytesToRead) => {
      assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
      var endPtr = ptr;
      // TextDecoder needs to know the byte length in advance, it doesn't stop on
      // null terminator by itself.
      // Also, use the length info to avoid running tiny strings through
      // TextDecoder, since .subarray() allocates garbage.
      var idx = endPtr >> 1;
      var maxIdx = idx + maxBytesToRead / 2;
      // If maxBytesToRead is not passed explicitly, it will be undefined, and this
      // will always evaluate to true. This saves on code size.
      while (!(idx >= maxIdx) && HEAPU16[idx]) ++idx;
      endPtr = idx << 1;
  
      if (endPtr - ptr > 32 && UTF16Decoder)
        return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  
      // Fallback: decode without UTF16Decoder
      var str = '';
  
      // If maxBytesToRead is not passed explicitly, it will be undefined, and the
      // for-loop's condition will always evaluate to true. The loop is then
      // terminated on the first null char.
      for (var i = 0; !(i >= maxBytesToRead / 2); ++i) {
        var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
        if (codeUnit == 0) break;
        // fromCharCode constructs a character from a UTF-16 code unit, so we can
        // pass the UTF16 string right through.
        str += String.fromCharCode(codeUnit);
      }
  
      return str;
    };
  
  var stringToUTF16 = (str, outPtr, maxBytesToWrite) => {
      assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
      assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
      // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
      if (maxBytesToWrite === undefined) {
        maxBytesToWrite = 0x7FFFFFFF;
      }
      if (maxBytesToWrite < 2) return 0;
      maxBytesToWrite -= 2; // Null terminator.
      var startPtr = outPtr;
      var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
      for (var i = 0; i < numCharsToWrite; ++i) {
        // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
        var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
        HEAP16[((outPtr)>>1)] = codeUnit;
        outPtr += 2;
      }
      // Null-terminate the pointer to the HEAP.
      HEAP16[((outPtr)>>1)] = 0;
      return outPtr - startPtr;
    };
  
  var lengthBytesUTF16 = (str) => {
      return str.length*2;
    };
  
  var UTF32ToString = (ptr, maxBytesToRead) => {
      assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
      var i = 0;
  
      var str = '';
      // If maxBytesToRead is not passed explicitly, it will be undefined, and this
      // will always evaluate to true. This saves on code size.
      while (!(i >= maxBytesToRead / 4)) {
        var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
        if (utf32 == 0) break;
        ++i;
        // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        if (utf32 >= 0x10000) {
          var ch = utf32 - 0x10000;
          str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
        } else {
          str += String.fromCharCode(utf32);
        }
      }
      return str;
    };
  
  var stringToUTF32 = (str, outPtr, maxBytesToWrite) => {
      assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
      assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
      // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
      if (maxBytesToWrite === undefined) {
        maxBytesToWrite = 0x7FFFFFFF;
      }
      if (maxBytesToWrite < 4) return 0;
      var startPtr = outPtr;
      var endPtr = startPtr + maxBytesToWrite - 4;
      for (var i = 0; i < str.length; ++i) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
        if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
          var trailSurrogate = str.charCodeAt(++i);
          codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
        }
        HEAP32[((outPtr)>>2)] = codeUnit;
        outPtr += 4;
        if (outPtr + 4 > endPtr) break;
      }
      // Null-terminate the pointer to the HEAP.
      HEAP32[((outPtr)>>2)] = 0;
      return outPtr - startPtr;
    };
  
  var lengthBytesUTF32 = (str) => {
      var len = 0;
      for (var i = 0; i < str.length; ++i) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        var codeUnit = str.charCodeAt(i);
        if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
        len += 4;
      }
  
      return len;
    };
  var __embind_register_std_wstring = (rawType, charSize, name) => {
      name = readLatin1String(name);
      var decodeString, encodeString, getHeap, lengthBytesUTF, shift;
      if (charSize === 2) {
        decodeString = UTF16ToString;
        encodeString = stringToUTF16;
        lengthBytesUTF = lengthBytesUTF16;
        getHeap = () => HEAPU16;
        shift = 1;
      } else if (charSize === 4) {
        decodeString = UTF32ToString;
        encodeString = stringToUTF32;
        lengthBytesUTF = lengthBytesUTF32;
        getHeap = () => HEAPU32;
        shift = 2;
      }
      registerType(rawType, {
        name,
        'fromWireType': (value) => {
          // Code mostly taken from _embind_register_std_string fromWireType
          var length = HEAPU32[((value)>>2)];
          var HEAP = getHeap();
          var str;
  
          var decodeStartPtr = value + 4;
          // Looping here to support possible embedded '0' bytes
          for (var i = 0; i <= length; ++i) {
            var currentBytePtr = value + 4 + i * charSize;
            if (i == length || HEAP[currentBytePtr >> shift] == 0) {
              var maxReadBytes = currentBytePtr - decodeStartPtr;
              var stringSegment = decodeString(decodeStartPtr, maxReadBytes);
              if (str === undefined) {
                str = stringSegment;
              } else {
                str += String.fromCharCode(0);
                str += stringSegment;
              }
              decodeStartPtr = currentBytePtr + charSize;
            }
          }
  
          _free(value);
  
          return str;
        },
        'toWireType': (destructors, value) => {
          if (!(typeof value == 'string')) {
            throwBindingError(`Cannot pass non-string to C++ string type ${name}`);
          }
  
          // assumes 4-byte alignment
          var length = lengthBytesUTF(value);
          var ptr = _malloc(4 + length + charSize);
          HEAPU32[ptr >> 2] = length >> shift;
  
          encodeString(value, ptr + 4, length + charSize);
  
          if (destructors !== null) {
            destructors.push(_free, ptr);
          }
          return ptr;
        },
        'argPackAdvance': GenericWireTypeSize,
        'readValueFromPointer': simpleReadValueFromPointer,
        destructorFunction(ptr) {
          _free(ptr);
        }
      });
    };

  
  var __embind_register_void = (rawType, name) => {
      name = readLatin1String(name);
      registerType(rawType, {
        isVoid: true, // void return values can be optimized out sometimes
        name,
        'argPackAdvance': 0,
        'fromWireType': () => undefined,
        // TODO: assert if anything else is given?
        'toWireType': (destructors, o) => undefined,
      });
    };

  var nowIsMonotonic = 1;
  var __emscripten_get_now_is_monotonic = () => nowIsMonotonic;

  var __emscripten_throw_longjmp = () => {
      throw Infinity;
    };

  
  
  
  
  
  var convertI32PairToI53Checked = (lo, hi) => {
      assert(lo == (lo >>> 0) || lo == (lo|0)); // lo should either be a i32 or a u32
      assert(hi === (hi|0));                    // hi should be a i32
      return ((hi + 0x200000) >>> 0 < 0x400001 - !!lo) ? (lo >>> 0) + hi * 4294967296 : NaN;
    };
  function __mmap_js(len,prot,flags,fd,offset_low, offset_high,allocated,addr) {
    var offset = convertI32PairToI53Checked(offset_low, offset_high);;
  
    
  try {
  
      if (isNaN(offset)) return 61;
      var stream = SYSCALLS.getStreamFromFD(fd);
      var res = FS.mmap(stream, len, offset, prot, flags);
      var ptr = res.ptr;
      HEAP32[((allocated)>>2)] = res.allocated;
      HEAPU32[((addr)>>2)] = ptr;
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  ;
  }

  
  
  
  function __munmap_js(addr,len,prot,flags,fd,offset_low, offset_high) {
    var offset = convertI32PairToI53Checked(offset_low, offset_high);;
  
    
  try {
  
      if (isNaN(offset)) return 61;
      var stream = SYSCALLS.getStreamFromFD(fd);
      if (prot & 2) {
        SYSCALLS.doMsync(addr, stream, len, flags, offset);
      }
      FS.munmap(stream);
      // implicitly return 0
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  ;
  }

  var _abort = () => {
      abort('native code called abort()');
    };

  var readEmAsmArgsArray = [];
  var readEmAsmArgs = (sigPtr, buf) => {
      // Nobody should have mutated _readEmAsmArgsArray underneath us to be something else than an array.
      assert(Array.isArray(readEmAsmArgsArray));
      // The input buffer is allocated on the stack, so it must be stack-aligned.
      assert(buf % 16 == 0);
      readEmAsmArgsArray.length = 0;
      var ch;
      // Most arguments are i32s, so shift the buffer pointer so it is a plain
      // index into HEAP32.
      while (ch = HEAPU8[sigPtr++]) {
        var chr = String.fromCharCode(ch);
        var validChars = ['d', 'f', 'i', 'p'];
        assert(validChars.includes(chr), `Invalid character ${ch}("${chr}") in readEmAsmArgs! Use only [${validChars}], and do not specify "v" for void return argument.`);
        // Floats are always passed as doubles, so all types except for 'i'
        // are 8 bytes and require alignment.
        var wide = (ch != 105);
        wide &= (ch != 112);
        buf += wide && (buf % 8) ? 4 : 0;
        readEmAsmArgsArray.push(
          // Special case for pointers under wasm64 or CAN_ADDRESS_2GB mode.
          ch == 112 ? HEAPU32[((buf)>>2)] :
          ch == 105 ?
            HEAP32[((buf)>>2)] :
            HEAPF64[((buf)>>3)]
        );
        buf += wide ? 8 : 4;
      }
      return readEmAsmArgsArray;
    };
  var runEmAsmFunction = (code, sigPtr, argbuf) => {
      var args = readEmAsmArgs(sigPtr, argbuf);
      assert(ASM_CONSTS.hasOwnProperty(code), `No EM_ASM constant found at address ${code}.  The loaded WebAssembly file is likely out of sync with the generated JavaScript.`);
      return ASM_CONSTS[code].apply(null, args);
    };
  var _emscripten_asm_const_int = (code, sigPtr, argbuf) => {
      return runEmAsmFunction(code, sigPtr, argbuf);
    };

  var _emscripten_date_now = () => Date.now();

  var _emscripten_get_now;
      // Modern environment where performance.now() is supported:
      // N.B. a shorter form "_emscripten_get_now = performance.now;" is
      // unfortunately not allowed even in current browsers (e.g. FF Nightly 75).
      _emscripten_get_now = () => performance.now();
  ;

  var _emscripten_memcpy_js = (dest, src, num) => HEAPU8.copyWithin(dest, src, src + num);

  var getHeapMax = () =>
      // Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
      // full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
      // for any code that deals with heap sizes, which would require special
      // casing all heap size related code to treat 0 specially.
      2147483648;
  
  var growMemory = (size) => {
      var b = wasmMemory.buffer;
      var pages = (size - b.byteLength + 65535) / 65536;
      try {
        // round size grow request up to wasm page size (fixed 64KB per spec)
        wasmMemory.grow(pages); // .grow() takes a delta compared to the previous size
        updateMemoryViews();
        return 1 /*success*/;
      } catch(e) {
        err(`growMemory: Attempted to grow heap from ${b.byteLength} bytes to ${size} bytes, but got error: ${e}`);
      }
      // implicit 0 return to save code size (caller will cast "undefined" into 0
      // anyhow)
    };
  var _emscripten_resize_heap = (requestedSize) => {
      var oldSize = HEAPU8.length;
      // With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
      requestedSize >>>= 0;
      // With multithreaded builds, races can happen (another thread might increase the size
      // in between), so return a failure, and let the caller retry.
      assert(requestedSize > oldSize);
  
      // Memory resize rules:
      // 1.  Always increase heap size to at least the requested size, rounded up
      //     to next page multiple.
      // 2a. If MEMORY_GROWTH_LINEAR_STEP == -1, excessively resize the heap
      //     geometrically: increase the heap size according to
      //     MEMORY_GROWTH_GEOMETRIC_STEP factor (default +20%), At most
      //     overreserve by MEMORY_GROWTH_GEOMETRIC_CAP bytes (default 96MB).
      // 2b. If MEMORY_GROWTH_LINEAR_STEP != -1, excessively resize the heap
      //     linearly: increase the heap size by at least
      //     MEMORY_GROWTH_LINEAR_STEP bytes.
      // 3.  Max size for the heap is capped at 2048MB-WASM_PAGE_SIZE, or by
      //     MAXIMUM_MEMORY, or by ASAN limit, depending on which is smallest
      // 4.  If we were unable to allocate as much memory, it may be due to
      //     over-eager decision to excessively reserve due to (3) above.
      //     Hence if an allocation fails, cut down on the amount of excess
      //     growth, in an attempt to succeed to perform a smaller allocation.
  
      // A limit is set for how much we can grow. We should not exceed that
      // (the wasm binary specifies it, so if we tried, we'd fail anyhow).
      var maxHeapSize = getHeapMax();
      if (requestedSize > maxHeapSize) {
        err(`Cannot enlarge memory, requested ${requestedSize} bytes, but the limit is ${maxHeapSize} bytes!`);
        return false;
      }
  
      var alignUp = (x, multiple) => x + (multiple - x % multiple) % multiple;
  
      // Loop through potential heap size increases. If we attempt a too eager
      // reservation that fails, cut down on the attempted size and reserve a
      // smaller bump instead. (max 3 times, chosen somewhat arbitrarily)
      for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
        var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown); // ensure geometric growth
        // but limit overreserving (default to capping at +96MB overgrowth at most)
        overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296 );
  
        var newSize = Math.min(maxHeapSize, alignUp(Math.max(requestedSize, overGrownHeapSize), 65536));
  
        var replacement = growMemory(newSize);
        if (replacement) {
  
          return true;
        }
      }
      err(`Failed to grow the heap from ${oldSize} bytes to ${newSize} bytes, not enough memory!`);
      return false;
    };

  var ENV = {
  };
  
  var getExecutableName = () => {
      return thisProgram || './this.program';
    };
  var getEnvStrings = () => {
      if (!getEnvStrings.strings) {
        // Default values.
        // Browser language detection #8751
        var lang = ((typeof navigator == 'object' && navigator.languages && navigator.languages[0]) || 'C').replace('-', '_') + '.UTF-8';
        var env = {
          'USER': 'web_user',
          'LOGNAME': 'web_user',
          'PATH': '/',
          'PWD': '/',
          'HOME': '/home/web_user',
          'LANG': lang,
          '_': getExecutableName()
        };
        // Apply the user-provided values, if any.
        for (var x in ENV) {
          // x is a key in ENV; if ENV[x] is undefined, that means it was
          // explicitly set to be so. We allow user code to do that to
          // force variables with default values to remain unset.
          if (ENV[x] === undefined) delete env[x];
          else env[x] = ENV[x];
        }
        var strings = [];
        for (var x in env) {
          strings.push(`${x}=${env[x]}`);
        }
        getEnvStrings.strings = strings;
      }
      return getEnvStrings.strings;
    };
  
  var stringToAscii = (str, buffer) => {
      for (var i = 0; i < str.length; ++i) {
        assert(str.charCodeAt(i) === (str.charCodeAt(i) & 0xff));
        HEAP8[((buffer++)>>0)] = str.charCodeAt(i);
      }
      // Null-terminate the string
      HEAP8[((buffer)>>0)] = 0;
    };
  
  var _environ_get = (__environ, environ_buf) => {
      var bufSize = 0;
      getEnvStrings().forEach((string, i) => {
        var ptr = environ_buf + bufSize;
        HEAPU32[(((__environ)+(i*4))>>2)] = ptr;
        stringToAscii(string, ptr);
        bufSize += string.length + 1;
      });
      return 0;
    };

  
  var _environ_sizes_get = (penviron_count, penviron_buf_size) => {
      var strings = getEnvStrings();
      HEAPU32[((penviron_count)>>2)] = strings.length;
      var bufSize = 0;
      strings.forEach((string) => bufSize += string.length + 1);
      HEAPU32[((penviron_buf_size)>>2)] = bufSize;
      return 0;
    };

  
  var runtimeKeepaliveCounter = 0;
  var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;
  
  var _proc_exit = (code) => {
      EXITSTATUS = code;
      if (!keepRuntimeAlive()) {
        if (Module['onExit']) Module['onExit'](code);
        ABORT = true;
      }
      quit_(code, new ExitStatus(code));
    };
  
  /** @suppress {duplicate } */
  /** @param {boolean|number=} implicit */
  var exitJS = (status, implicit) => {
      EXITSTATUS = status;
  
      checkUnflushedContent();
  
      // if exit() was called explicitly, warn the user if the runtime isn't actually being shut down
      if (keepRuntimeAlive() && !implicit) {
        var msg = `program exited (with status: ${status}), but keepRuntimeAlive() is set (counter=${runtimeKeepaliveCounter}) due to an async operation, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)`;
        err(msg);
      }
  
      _proc_exit(status);
    };
  var _exit = exitJS;

  function _fd_close(fd) {
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return e.errno;
  }
  }

  /** @param {number=} offset */
  var doReadv = (stream, iov, iovcnt, offset) => {
      var ret = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAPU32[((iov)>>2)];
        var len = HEAPU32[(((iov)+(4))>>2)];
        iov += 8;
        var curr = FS.read(stream, HEAP8, ptr, len, offset);
        if (curr < 0) return -1;
        ret += curr;
        if (curr < len) break; // nothing more to read
        if (typeof offset !== 'undefined') {
          offset += curr;
        }
      }
      return ret;
    };
  
  
  function _fd_pread(fd,iov,iovcnt,offset_low, offset_high,pnum) {
    var offset = convertI32PairToI53Checked(offset_low, offset_high);;
  
    
  try {
  
      if (isNaN(offset)) return 61;
      var stream = SYSCALLS.getStreamFromFD(fd)
      var num = doReadv(stream, iov, iovcnt, offset);
      HEAPU32[((pnum)>>2)] = num;
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return e.errno;
  }
  ;
  }

  
  function _fd_read(fd, iov, iovcnt, pnum) {
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      var num = doReadv(stream, iov, iovcnt);
      HEAPU32[((pnum)>>2)] = num;
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return e.errno;
  }
  }

  
  function _fd_seek(fd,offset_low, offset_high,whence,newOffset) {
    var offset = convertI32PairToI53Checked(offset_low, offset_high);;
  
    
  try {
  
      if (isNaN(offset)) return 61;
      var stream = SYSCALLS.getStreamFromFD(fd);
      FS.llseek(stream, offset, whence);
      (tempI64 = [stream.position>>>0,(tempDouble = stream.position,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[((newOffset)>>2)] = tempI64[0],HEAP32[(((newOffset)+(4))>>2)] = tempI64[1]);
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return e.errno;
  }
  ;
  }

  /** @param {number=} offset */
  var doWritev = (stream, iov, iovcnt, offset) => {
      var ret = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAPU32[((iov)>>2)];
        var len = HEAPU32[(((iov)+(4))>>2)];
        iov += 8;
        var curr = FS.write(stream, HEAP8, ptr, len, offset);
        if (curr < 0) return -1;
        ret += curr;
        if (typeof offset !== 'undefined') {
          offset += curr;
        }
      }
      return ret;
    };
  
  function _fd_write(fd, iov, iovcnt, pnum) {
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      var num = doWritev(stream, iov, iovcnt);
      HEAPU32[((pnum)>>2)] = num;
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return e.errno;
  }
  }

  var webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance = (ctx) =>
      // Closure is expected to be allowed to minify the '.dibvbi' property, so not accessing it quoted.
      !!(ctx.dibvbi = ctx.getExtension('WEBGL_draw_instanced_base_vertex_base_instance'));
  
  var webgl_enable_WEBGL_multi_draw_instanced_base_vertex_base_instance = (ctx) => {
      // Closure is expected to be allowed to minify the '.mdibvbi' property, so not accessing it quoted.
      return !!(ctx.mdibvbi = ctx.getExtension('WEBGL_multi_draw_instanced_base_vertex_base_instance'));
    };
  
  var webgl_enable_WEBGL_multi_draw = (ctx) => {
      // Closure is expected to be allowed to minify the '.multiDrawWebgl' property, so not accessing it quoted.
      return !!(ctx.multiDrawWebgl = ctx.getExtension('WEBGL_multi_draw'));
    };
  
  
  var GL = {
  counter:1,
  buffers:[],
  programs:[],
  framebuffers:[],
  renderbuffers:[],
  textures:[],
  shaders:[],
  vaos:[],
  contexts:[],
  offscreenCanvases:{
  },
  queries:[],
  samplers:[],
  transformFeedbacks:[],
  syncs:[],
  stringCache:{
  },
  stringiCache:{
  },
  unpackAlignment:4,
  recordError:function recordError(errorCode) {
        if (!GL.lastError) {
          GL.lastError = errorCode;
        }
      },
  getNewId:(table) => {
        var ret = GL.counter++;
        for (var i = table.length; i < ret; i++) {
          table[i] = null;
        }
        return ret;
      },
  getSource:(shader, count, string, length) => {
        var source = '';
        for (var i = 0; i < count; ++i) {
          var len = length ? HEAP32[(((length)+(i*4))>>2)] : -1;
          source += UTF8ToString(HEAP32[(((string)+(i*4))>>2)], len < 0 ? undefined : len);
        }
        return source;
      },
  createContext:(/** @type {HTMLCanvasElement} */ canvas, webGLContextAttributes) => {
        // In proxied operation mode, rAF()/setTimeout() functions do not delimit
        // frame boundaries, so can't have WebGL implementation try to detect when
        // it's ok to discard contents of the rendered backbuffer.
        if (webGLContextAttributes.renderViaOffscreenBackBuffer) webGLContextAttributes['preserveDrawingBuffer'] = true;
  
        // BUG: Workaround Safari WebGL issue: After successfully acquiring WebGL
        // context on a canvas, calling .getContext() will always return that
        // context independent of which 'webgl' or 'webgl2'
        // context version was passed. See:
        //   https://bugs.webkit.org/show_bug.cgi?id=222758
        // and:
        //   https://github.com/emscripten-core/emscripten/issues/13295.
        // TODO: Once the bug is fixed and shipped in Safari, adjust the Safari
        // version field in above check.
        if (!canvas.getContextSafariWebGL2Fixed) {
          canvas.getContextSafariWebGL2Fixed = canvas.getContext;
          /** @type {function(this:HTMLCanvasElement, string, (Object|null)=): (Object|null)} */
          function fixedGetContext(ver, attrs) {
            var gl = canvas.getContextSafariWebGL2Fixed(ver, attrs);
            return ((ver == 'webgl') == (gl instanceof WebGLRenderingContext)) ? gl : null;
          }
          canvas.getContext = fixedGetContext;
        }
  
        var ctx = canvas.getContext("webgl2", webGLContextAttributes);
  
        if (!ctx) return 0;
  
        var handle = GL.registerContext(ctx, webGLContextAttributes);
  
        return handle;
      },
  enableOffscreenFramebufferAttributes:(webGLContextAttributes) => {
        webGLContextAttributes.renderViaOffscreenBackBuffer = true;
        webGLContextAttributes.preserveDrawingBuffer = true;
      },
  createOffscreenFramebuffer:(context) => {
        var gl = context.GLctx;
  
        // Create FBO
        var fbo = gl.createFramebuffer();
        gl.bindFramebuffer(0x8D40 /*GL_FRAMEBUFFER*/, fbo);
        context.defaultFbo = fbo;
  
        context.defaultFboForbidBlitFramebuffer = false;
        if (gl.getContextAttributes().antialias) {
          context.defaultFboForbidBlitFramebuffer = true;
        }
  
        // Create render targets to the FBO
        context.defaultColorTarget = gl.createTexture();
        context.defaultDepthTarget = gl.createRenderbuffer();
        // Size them up correctly (use the same mechanism when resizing on demand)
        GL.resizeOffscreenFramebuffer(context);
  
        gl.bindTexture(0xDE1 /*GL_TEXTURE_2D*/, context.defaultColorTarget);
        gl.texParameteri(0xDE1 /*GL_TEXTURE_2D*/, 0x2801 /*GL_TEXTURE_MIN_FILTER*/, 0x2600 /*GL_NEAREST*/);
        gl.texParameteri(0xDE1 /*GL_TEXTURE_2D*/, 0x2800 /*GL_TEXTURE_MAG_FILTER*/, 0x2600 /*GL_NEAREST*/);
        gl.texParameteri(0xDE1 /*GL_TEXTURE_2D*/, 0x2802 /*GL_TEXTURE_WRAP_S*/, 0x812F /*GL_CLAMP_TO_EDGE*/);
        gl.texParameteri(0xDE1 /*GL_TEXTURE_2D*/, 0x2803 /*GL_TEXTURE_WRAP_T*/, 0x812F /*GL_CLAMP_TO_EDGE*/);
        gl.texImage2D(0xDE1 /*GL_TEXTURE_2D*/, 0, 0x1908 /*GL_RGBA*/, gl.canvas.width, gl.canvas.height, 0, 0x1908 /*GL_RGBA*/, 0x1401 /*GL_UNSIGNED_BYTE*/, null);
        gl.framebufferTexture2D(0x8D40 /*GL_FRAMEBUFFER*/, 0x8CE0 /*GL_COLOR_ATTACHMENT0*/, 0xDE1 /*GL_TEXTURE_2D*/, context.defaultColorTarget, 0);
        gl.bindTexture(0xDE1 /*GL_TEXTURE_2D*/, null);
  
        // Create depth render target to the FBO
        var depthTarget = gl.createRenderbuffer();
        gl.bindRenderbuffer(0x8D41 /*GL_RENDERBUFFER*/, context.defaultDepthTarget);
        gl.renderbufferStorage(0x8D41 /*GL_RENDERBUFFER*/, 0x81A5 /*GL_DEPTH_COMPONENT16*/, gl.canvas.width, gl.canvas.height);
        gl.framebufferRenderbuffer(0x8D40 /*GL_FRAMEBUFFER*/, 0x8D00 /*GL_DEPTH_ATTACHMENT*/, 0x8D41 /*GL_RENDERBUFFER*/, context.defaultDepthTarget);
        gl.bindRenderbuffer(0x8D41 /*GL_RENDERBUFFER*/, null);
  
        // Create blitter
        var vertices = [
          -1, -1,
          -1,  1,
           1, -1,
           1,  1
        ];
        var vb = gl.createBuffer();
        gl.bindBuffer(0x8892 /*GL_ARRAY_BUFFER*/, vb);
        gl.bufferData(0x8892 /*GL_ARRAY_BUFFER*/, new Float32Array(vertices), 0x88E4 /*GL_STATIC_DRAW*/);
        gl.bindBuffer(0x8892 /*GL_ARRAY_BUFFER*/, null);
        context.blitVB = vb;
  
        var vsCode =
          'attribute vec2 pos;' +
          'varying lowp vec2 tex;' +
          'void main() { tex = pos * 0.5 + vec2(0.5,0.5); gl_Position = vec4(pos, 0.0, 1.0); }';
        var vs = gl.createShader(0x8B31 /*GL_VERTEX_SHADER*/);
        gl.shaderSource(vs, vsCode);
        gl.compileShader(vs);
  
        var fsCode =
          'varying lowp vec2 tex;' +
          'uniform sampler2D sampler;' +
          'void main() { gl_FragColor = texture2D(sampler, tex); }';
        var fs = gl.createShader(0x8B30 /*GL_FRAGMENT_SHADER*/);
        gl.shaderSource(fs, fsCode);
        gl.compileShader(fs);
  
        var blitProgram = gl.createProgram();
        gl.attachShader(blitProgram, vs);
        gl.attachShader(blitProgram, fs);
        gl.linkProgram(blitProgram);
        context.blitProgram = blitProgram;
        context.blitPosLoc = gl.getAttribLocation(blitProgram, "pos");
        gl.useProgram(blitProgram);
        gl.uniform1i(gl.getUniformLocation(blitProgram, "sampler"), 0);
        gl.useProgram(null);
  
        context.defaultVao = undefined;
        if (gl.createVertexArray) {
          context.defaultVao = gl.createVertexArray();
          gl.bindVertexArray(context.defaultVao);
          gl.enableVertexAttribArray(context.blitPosLoc);
          gl.bindVertexArray(null);
        }
      },
  resizeOffscreenFramebuffer:(context) => {
        var gl = context.GLctx;
  
        // Resize color buffer
        if (context.defaultColorTarget) {
          var prevTextureBinding = gl.getParameter(0x8069 /*GL_TEXTURE_BINDING_2D*/);
          gl.bindTexture(0xDE1 /*GL_TEXTURE_2D*/, context.defaultColorTarget);
          gl.texImage2D(0xDE1 /*GL_TEXTURE_2D*/, 0, 0x1908 /*GL_RGBA*/, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, 0x1908 /*GL_RGBA*/, 0x1401 /*GL_UNSIGNED_BYTE*/, null);
          gl.bindTexture(0xDE1 /*GL_TEXTURE_2D*/, prevTextureBinding);
        }
  
        // Resize depth buffer
        if (context.defaultDepthTarget) {
          var prevRenderBufferBinding = gl.getParameter(0x8CA7 /*GL_RENDERBUFFER_BINDING*/);
          gl.bindRenderbuffer(0x8D41 /*GL_RENDERBUFFER*/, context.defaultDepthTarget);
          gl.renderbufferStorage(0x8D41 /*GL_RENDERBUFFER*/, 0x81A5 /*GL_DEPTH_COMPONENT16*/, gl.drawingBufferWidth, gl.drawingBufferHeight); // TODO: Read context creation parameters for what type of depth and stencil to use
          gl.bindRenderbuffer(0x8D41 /*GL_RENDERBUFFER*/, prevRenderBufferBinding);
        }
      },
  blitOffscreenFramebuffer:(context) => {
        var gl = context.GLctx;
  
        var prevScissorTest = gl.getParameter(0xC11 /*GL_SCISSOR_TEST*/);
        if (prevScissorTest) gl.disable(0xC11 /*GL_SCISSOR_TEST*/);
  
        var prevFbo = gl.getParameter(0x8CA6 /*GL_FRAMEBUFFER_BINDING*/);
  
        if (gl.blitFramebuffer && !context.defaultFboForbidBlitFramebuffer) {
          gl.bindFramebuffer(0x8CA8 /*GL_READ_FRAMEBUFFER*/, context.defaultFbo);
          gl.bindFramebuffer(0x8CA9 /*GL_DRAW_FRAMEBUFFER*/, null);
          gl.blitFramebuffer(0, 0, gl.canvas.width, gl.canvas.height,
                             0, 0, gl.canvas.width, gl.canvas.height,
                             0x4000 /*GL_COLOR_BUFFER_BIT*/, 0x2600/*GL_NEAREST*/);
        }
        else
        {
          gl.bindFramebuffer(0x8D40 /*GL_FRAMEBUFFER*/, null);
  
          var prevProgram = gl.getParameter(0x8B8D /*GL_CURRENT_PROGRAM*/);
          gl.useProgram(context.blitProgram);
  
          var prevVB = gl.getParameter(0x8894 /*GL_ARRAY_BUFFER_BINDING*/);
          gl.bindBuffer(0x8892 /*GL_ARRAY_BUFFER*/, context.blitVB);
  
          var prevActiveTexture = gl.getParameter(0x84E0 /*GL_ACTIVE_TEXTURE*/);
          gl.activeTexture(0x84C0 /*GL_TEXTURE0*/);
  
          var prevTextureBinding = gl.getParameter(0x8069 /*GL_TEXTURE_BINDING_2D*/);
          gl.bindTexture(0xDE1 /*GL_TEXTURE_2D*/, context.defaultColorTarget);
  
          var prevBlend = gl.getParameter(0xBE2 /*GL_BLEND*/);
          if (prevBlend) gl.disable(0xBE2 /*GL_BLEND*/);
  
          var prevCullFace = gl.getParameter(0xB44 /*GL_CULL_FACE*/);
          if (prevCullFace) gl.disable(0xB44 /*GL_CULL_FACE*/);
  
          var prevDepthTest = gl.getParameter(0xB71 /*GL_DEPTH_TEST*/);
          if (prevDepthTest) gl.disable(0xB71 /*GL_DEPTH_TEST*/);
  
          var prevStencilTest = gl.getParameter(0xB90 /*GL_STENCIL_TEST*/);
          if (prevStencilTest) gl.disable(0xB90 /*GL_STENCIL_TEST*/);
  
          function draw() {
            gl.vertexAttribPointer(context.blitPosLoc, 2, 0x1406 /*GL_FLOAT*/, false, 0, 0);
            gl.drawArrays(5/*GL_TRIANGLE_STRIP*/, 0, 4);
          }
  
          if (context.defaultVao) {
            // WebGL 2 or OES_vertex_array_object
            var prevVAO = gl.getParameter(0x85B5 /*GL_VERTEX_ARRAY_BINDING*/);
            gl.bindVertexArray(context.defaultVao);
            draw();
            gl.bindVertexArray(prevVAO);
          }
          else
          {
            var prevVertexAttribPointer = {
              buffer: gl.getVertexAttrib(context.blitPosLoc, 0x889F /*GL_VERTEX_ATTRIB_ARRAY_BUFFER_BINDING*/),
              size: gl.getVertexAttrib(context.blitPosLoc, 0x8623 /*GL_VERTEX_ATTRIB_ARRAY_SIZE*/),
              stride: gl.getVertexAttrib(context.blitPosLoc, 0x8624 /*GL_VERTEX_ATTRIB_ARRAY_STRIDE*/),
              type: gl.getVertexAttrib(context.blitPosLoc, 0x8625 /*GL_VERTEX_ATTRIB_ARRAY_TYPE*/),
              normalized: gl.getVertexAttrib(context.blitPosLoc, 0x886A /*GL_VERTEX_ATTRIB_ARRAY_NORMALIZED*/),
              pointer: gl.getVertexAttribOffset(context.blitPosLoc, 0x8645 /*GL_VERTEX_ATTRIB_ARRAY_POINTER*/),
            };
            var maxVertexAttribs = gl.getParameter(0x8869 /*GL_MAX_VERTEX_ATTRIBS*/);
            var prevVertexAttribEnables = [];
            for (var i = 0; i < maxVertexAttribs; ++i) {
              var prevEnabled = gl.getVertexAttrib(i, 0x8622 /*GL_VERTEX_ATTRIB_ARRAY_ENABLED*/);
              var wantEnabled = i == context.blitPosLoc;
              if (prevEnabled && !wantEnabled) {
                gl.disableVertexAttribArray(i);
              }
              if (!prevEnabled && wantEnabled) {
                gl.enableVertexAttribArray(i);
              }
              prevVertexAttribEnables[i] = prevEnabled;
            }
  
            draw();
  
            for (var i = 0; i < maxVertexAttribs; ++i) {
              var prevEnabled = prevVertexAttribEnables[i];
              var nowEnabled = i == context.blitPosLoc;
              if (prevEnabled && !nowEnabled) {
                gl.enableVertexAttribArray(i);
              }
              if (!prevEnabled && nowEnabled) {
                gl.disableVertexAttribArray(i);
              }
            }
            gl.bindBuffer(0x8892 /*GL_ARRAY_BUFFER*/, prevVertexAttribPointer.buffer);
            gl.vertexAttribPointer(context.blitPosLoc,
                                   prevVertexAttribPointer.size,
                                   prevVertexAttribPointer.type,
                                   prevVertexAttribPointer.normalized,
                                   prevVertexAttribPointer.stride,
                                   prevVertexAttribPointer.offset);
          }
  
          if (prevStencilTest) gl.enable(0xB90 /*GL_STENCIL_TEST*/);
          if (prevDepthTest) gl.enable(0xB71 /*GL_DEPTH_TEST*/);
          if (prevCullFace) gl.enable(0xB44 /*GL_CULL_FACE*/);
          if (prevBlend) gl.enable(0xBE2 /*GL_BLEND*/);
  
          gl.bindTexture(0xDE1 /*GL_TEXTURE_2D*/, prevTextureBinding);
          gl.activeTexture(prevActiveTexture);
          gl.bindBuffer(0x8892 /*GL_ARRAY_BUFFER*/, prevVB);
          gl.useProgram(prevProgram);
        }
        gl.bindFramebuffer(0x8D40 /*GL_FRAMEBUFFER*/, prevFbo);
        if (prevScissorTest) gl.enable(0xC11 /*GL_SCISSOR_TEST*/);
      },
  registerContext:(ctx, webGLContextAttributes) => {
        // without pthreads a context is just an integer ID
        var handle = GL.getNewId(GL.contexts);
  
        var context = {
          handle,
          attributes: webGLContextAttributes,
          version: webGLContextAttributes.majorVersion,
          GLctx: ctx
        };
  
        // Store the created context object so that we can access the context
        // given a canvas without having to pass the parameters again.
        if (ctx.canvas) ctx.canvas.GLctxObject = context;
        GL.contexts[handle] = context;
        if (typeof webGLContextAttributes.enableExtensionsByDefault == 'undefined' || webGLContextAttributes.enableExtensionsByDefault) {
          GL.initExtensions(context);
        }
  
        if (webGLContextAttributes.renderViaOffscreenBackBuffer) GL.createOffscreenFramebuffer(context);
        return handle;
      },
  makeContextCurrent:(contextHandle) => {
  
        // Active Emscripten GL layer context object.
        GL.currentContext = GL.contexts[contextHandle];
        // Active WebGL context object.
        Module.ctx = GLctx = GL.currentContext && GL.currentContext.GLctx;
        return !(contextHandle && !GLctx);
      },
  getContext:(contextHandle) => {
        return GL.contexts[contextHandle];
      },
  deleteContext:(contextHandle) => {
        if (GL.currentContext === GL.contexts[contextHandle]) {
          GL.currentContext = null;
        }
        if (typeof JSEvents == 'object') {
          // Release all JS event handlers on the DOM element that the GL context is
          // associated with since the context is now deleted.
          JSEvents.removeAllHandlersOnTarget(GL.contexts[contextHandle].GLctx.canvas);
        }
        // Make sure the canvas object no longer refers to the context object so
        // there are no GC surprises.
        if (GL.contexts[contextHandle] && GL.contexts[contextHandle].GLctx.canvas) {
          GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined;
        }
        GL.contexts[contextHandle] = null;
      },
  initExtensions:(context) => {
        // If this function is called without a specific context object, init the
        // extensions of the currently active context.
        if (!context) context = GL.currentContext;
  
        if (context.initExtensionsDone) return;
        context.initExtensionsDone = true;
  
        var GLctx = context.GLctx;
  
        // Detect the presence of a few extensions manually, ction GL interop
        // layer itself will need to know if they exist.
  
        // Extensions that are available from WebGL >= 2 (no-op if called on a WebGL 1 context active)
        webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance(GLctx);
        webgl_enable_WEBGL_multi_draw_instanced_base_vertex_base_instance(GLctx);
  
        // On WebGL 2, EXT_disjoint_timer_query is replaced with an alternative
        // that's based on core APIs, and exposes only the queryCounterEXT()
        // entrypoint.
        if (context.version >= 2) {
          GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query_webgl2");
        }
  
        // However, Firefox exposes the WebGL 1 version on WebGL 2 as well and
        // thus we look for the WebGL 1 version again if the WebGL 2 version
        // isn't present. https://bugzilla.mozilla.org/show_bug.cgi?id=1328882
        if (context.version < 2 || !GLctx.disjointTimerQueryExt)
        {
          GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query");
        }
  
        webgl_enable_WEBGL_multi_draw(GLctx);
  
        // .getSupportedExtensions() can return null if context is lost, so coerce
        // to empty array.
        var exts = GLctx.getSupportedExtensions() || [];
        exts.forEach((ext) => {
          // WEBGL_lose_context, WEBGL_debug_renderer_info and WEBGL_debug_shaders
          // are not enabled by default.
          if (!ext.includes('lose_context') && !ext.includes('debug')) {
            // Call .getExtension() to enable that extension permanently.
            GLctx.getExtension(ext);
          }
        });
      },
  getExtensions() {
        // .getSupportedExtensions() can return null if context is lost, so coerce to empty array.
        var exts = GLctx.getSupportedExtensions() || [];
        exts = exts.concat(exts.map((e) => "GL_" + e));
        return exts;
      },
  };
  function _glActiveTexture(x0) { GLctx.activeTexture(x0) }

  var _glAttachShader = (program, shader) => {
      GLctx.attachShader(GL.programs[program], GL.shaders[shader]);
    };

  
  var _glBindAttribLocation = (program, index, name) => {
      GLctx.bindAttribLocation(GL.programs[program], index, UTF8ToString(name));
    };

  var _glBindBuffer = (target, buffer) => {
  
      if (target == 0x88EB /*GL_PIXEL_PACK_BUFFER*/) {
        // In WebGL 2 glReadPixels entry point, we need to use a different WebGL 2
        // API function call when a buffer is bound to
        // GL_PIXEL_PACK_BUFFER_BINDING point, so must keep track whether that
        // binding point is non-null to know what is the proper API function to
        // call.
        GLctx.currentPixelPackBufferBinding = buffer;
      } else if (target == 0x88EC /*GL_PIXEL_UNPACK_BUFFER*/) {
        // In WebGL 2 gl(Compressed)Tex(Sub)Image[23]D entry points, we need to
        // use a different WebGL 2 API function call when a buffer is bound to
        // GL_PIXEL_UNPACK_BUFFER_BINDING point, so must keep track whether that
        // binding point is non-null to know what is the proper API function to
        // call.
        GLctx.currentPixelUnpackBufferBinding = buffer;
      }
      GLctx.bindBuffer(target, GL.buffers[buffer]);
    };

  var _glBindFramebuffer = (target, framebuffer) => {
  
      // defaultFbo may not be present if 'renderViaOffscreenBackBuffer' was not enabled during context creation time,
      // i.e. setting -sOFFSCREEN_FRAMEBUFFER at compilation time does not yet mandate that offscreen back buffer
      // is being used, but that is ultimately decided at context creation time.
      GLctx.bindFramebuffer(target, framebuffer ? GL.framebuffers[framebuffer] : GL.currentContext.defaultFbo);
  
    };

  var _glBindRenderbuffer = (target, renderbuffer) => {
      GLctx.bindRenderbuffer(target, GL.renderbuffers[renderbuffer]);
    };

  var _glBindSampler = (unit, sampler) => {
      GLctx.bindSampler(unit, GL.samplers[sampler]);
    };

  var _glBindTexture = (target, texture) => {
      GLctx.bindTexture(target, GL.textures[texture]);
    };

  var _glBindVertexArray = (vao) => {
      GLctx.bindVertexArray(GL.vaos[vao]);
    };

  
  var _glBindVertexArrayOES = _glBindVertexArray;

  function _glBlendColor(x0, x1, x2, x3) { GLctx.blendColor(x0, x1, x2, x3) }

  function _glBlendEquation(x0) { GLctx.blendEquation(x0) }

  function _glBlendFunc(x0, x1) { GLctx.blendFunc(x0, x1) }

  function _glBlitFramebuffer(x0, x1, x2, x3, x4, x5, x6, x7, x8, x9) { GLctx.blitFramebuffer(x0, x1, x2, x3, x4, x5, x6, x7, x8, x9) }

  var _glBufferData = (target, size, data, usage) => {
  
      if (true) {
        // WebGL 2 provides new garbage-free entry points to call to WebGL. Use
        // those always when possible.  If size is zero, WebGL would interpret
        // uploading the whole input arraybuffer (starting from given offset),
        // which would not make sense in WebAssembly, so avoid uploading if size
        // is zero. However we must still call bufferData to establish a backing
        // storage of zero bytes.
        if (data && size) {
          GLctx.bufferData(target, HEAPU8, usage, data, size);
        } else {
          GLctx.bufferData(target, size, usage);
        }
      } else {
        // N.b. here first form specifies a heap subarray, second form an integer
        // size, so the ?: code here is polymorphic. It is advised to avoid
        // randomly mixing both uses in calling code, to avoid any potential JS
        // engine JIT issues.
        GLctx.bufferData(target, data ? HEAPU8.subarray(data, data+size) : size, usage);
      }
    };

  var _glBufferSubData = (target, offset, size, data) => {
      if (true) {
        // WebGL 2 provides new garbage-free entry points to call to WebGL. Use
        // those always when possible.
        size && GLctx.bufferSubData(target, offset, HEAPU8, data, size);
        return;
      }
      GLctx.bufferSubData(target, offset, HEAPU8.subarray(data, data+size));
    };

  function _glCheckFramebufferStatus(x0) { return GLctx.checkFramebufferStatus(x0) }

  function _glClear(x0) { GLctx.clear(x0) }

  function _glClearColor(x0, x1, x2, x3) { GLctx.clearColor(x0, x1, x2, x3) }

  function _glClearStencil(x0) { GLctx.clearStencil(x0) }

  var convertI32PairToI53 = (lo, hi) => {
      // This function should not be getting called with too large unsigned numbers
      // in high part (if hi >= 0x7FFFFFFFF, one should have been calling
      // convertU32PairToI53())
      assert(hi === (hi|0));
      return (lo >>> 0) + hi * 4294967296;
    };
  var _glClientWaitSync = (sync, flags, timeout_low, timeout_high) => {
      // WebGL2 vs GLES3 differences: in GLES3, the timeout parameter is a uint64, where 0xFFFFFFFFFFFFFFFFULL means GL_TIMEOUT_IGNORED.
      // In JS, there's no 64-bit value types, so instead timeout is taken to be signed, and GL_TIMEOUT_IGNORED is given value -1.
      // Inherently the value accepted in the timeout is lossy, and can't take in arbitrary u64 bit pattern (but most likely doesn't matter)
      // See https://www.khronos.org/registry/webgl/specs/latest/2.0/#5.15
      var timeout = convertI32PairToI53(timeout_low, timeout_high);
      return GLctx.clientWaitSync(GL.syncs[sync], flags, timeout);
    };

  var _glColorMask = (red, green, blue, alpha) => {
      GLctx.colorMask(!!red, !!green, !!blue, !!alpha);
    };

  var _glCompileShader = (shader) => {
      GLctx.compileShader(GL.shaders[shader]);
    };

  var _glCompressedTexImage2D = (target, level, internalFormat, width, height, border, imageSize, data) => {
      if (true) {
        // WebGL 2 provides new garbage-free entry points to call to WebGL. Use
        // those always when possible.
        if (GLctx.currentPixelUnpackBufferBinding || !imageSize) {
          GLctx.compressedTexImage2D(target, level, internalFormat, width, height, border, imageSize, data);
        } else {
          GLctx.compressedTexImage2D(target, level, internalFormat, width, height, border, HEAPU8, data, imageSize);
        }
        return;
      }
      GLctx.compressedTexImage2D(target, level, internalFormat, width, height, border, data ? HEAPU8.subarray((data), (data+imageSize)) : null);
    };

  var _glCompressedTexSubImage2D = (target, level, xoffset, yoffset, width, height, format, imageSize, data) => {
      if (true) {
        // WebGL 2 provides new garbage-free entry points to call to WebGL. Use
        // those always when possible.
        if (GLctx.currentPixelUnpackBufferBinding || !imageSize) {
          GLctx.compressedTexSubImage2D(target, level, xoffset, yoffset, width, height, format, imageSize, data);
        } else {
          GLctx.compressedTexSubImage2D(target, level, xoffset, yoffset, width, height, format, HEAPU8, data, imageSize);
        }
        return;
      }
      GLctx.compressedTexSubImage2D(target, level, xoffset, yoffset, width, height, format, data ? HEAPU8.subarray((data), (data+imageSize)) : null);
    };

  function _glCopyBufferSubData(x0, x1, x2, x3, x4) { GLctx.copyBufferSubData(x0, x1, x2, x3, x4) }

  function _glCopyTexSubImage2D(x0, x1, x2, x3, x4, x5, x6, x7) { GLctx.copyTexSubImage2D(x0, x1, x2, x3, x4, x5, x6, x7) }

  var _glCreateProgram = () => {
      var id = GL.getNewId(GL.programs);
      var program = GLctx.createProgram();
      // Store additional information needed for each shader program:
      program.name = id;
      // Lazy cache results of
      // glGetProgramiv(GL_ACTIVE_UNIFORM_MAX_LENGTH/GL_ACTIVE_ATTRIBUTE_MAX_LENGTH/GL_ACTIVE_UNIFORM_BLOCK_MAX_NAME_LENGTH)
      program.maxUniformLength = program.maxAttributeLength = program.maxUniformBlockNameLength = 0;
      program.uniformIdCounter = 1;
      GL.programs[id] = program;
      return id;
    };

  var _glCreateShader = (shaderType) => {
      var id = GL.getNewId(GL.shaders);
      GL.shaders[id] = GLctx.createShader(shaderType);
  
      return id;
    };

  function _glCullFace(x0) { GLctx.cullFace(x0) }

  var _glDeleteBuffers = (n, buffers) => {
      for (var i = 0; i < n; i++) {
        var id = HEAP32[(((buffers)+(i*4))>>2)];
        var buffer = GL.buffers[id];
  
        // From spec: "glDeleteBuffers silently ignores 0's and names that do not
        // correspond to existing buffer objects."
        if (!buffer) continue;
  
        GLctx.deleteBuffer(buffer);
        buffer.name = 0;
        GL.buffers[id] = null;
  
        if (id == GLctx.currentPixelPackBufferBinding) GLctx.currentPixelPackBufferBinding = 0;
        if (id == GLctx.currentPixelUnpackBufferBinding) GLctx.currentPixelUnpackBufferBinding = 0;
      }
    };

  var _glDeleteFramebuffers = (n, framebuffers) => {
      for (var i = 0; i < n; ++i) {
        var id = HEAP32[(((framebuffers)+(i*4))>>2)];
        var framebuffer = GL.framebuffers[id];
        if (!framebuffer) continue; // GL spec: "glDeleteFramebuffers silently ignores 0s and names that do not correspond to existing framebuffer objects".
        GLctx.deleteFramebuffer(framebuffer);
        framebuffer.name = 0;
        GL.framebuffers[id] = null;
      }
    };

  var _glDeleteProgram = (id) => {
      if (!id) return;
      var program = GL.programs[id];
      if (!program) {
        // glDeleteProgram actually signals an error when deleting a nonexisting
        // object, unlike some other GL delete functions.
        GL.recordError(0x501 /* GL_INVALID_VALUE */);
        return;
      }
      GLctx.deleteProgram(program);
      program.name = 0;
      GL.programs[id] = null;
    };

  var _glDeleteRenderbuffers = (n, renderbuffers) => {
      for (var i = 0; i < n; i++) {
        var id = HEAP32[(((renderbuffers)+(i*4))>>2)];
        var renderbuffer = GL.renderbuffers[id];
        if (!renderbuffer) continue; // GL spec: "glDeleteRenderbuffers silently ignores 0s and names that do not correspond to existing renderbuffer objects".
        GLctx.deleteRenderbuffer(renderbuffer);
        renderbuffer.name = 0;
        GL.renderbuffers[id] = null;
      }
    };

  var _glDeleteSamplers = (n, samplers) => {
      for (var i = 0; i < n; i++) {
        var id = HEAP32[(((samplers)+(i*4))>>2)];
        var sampler = GL.samplers[id];
        if (!sampler) continue;
        GLctx.deleteSampler(sampler);
        sampler.name = 0;
        GL.samplers[id] = null;
      }
    };

  var _glDeleteShader = (id) => {
      if (!id) return;
      var shader = GL.shaders[id];
      if (!shader) {
        // glDeleteShader actually signals an error when deleting a nonexisting
        // object, unlike some other GL delete functions.
        GL.recordError(0x501 /* GL_INVALID_VALUE */);
        return;
      }
      GLctx.deleteShader(shader);
      GL.shaders[id] = null;
    };

  var _glDeleteSync = (id) => {
      if (!id) return;
      var sync = GL.syncs[id];
      if (!sync) { // glDeleteSync signals an error when deleting a nonexisting object, unlike some other GL delete functions.
        GL.recordError(0x501 /* GL_INVALID_VALUE */);
        return;
      }
      GLctx.deleteSync(sync);
      sync.name = 0;
      GL.syncs[id] = null;
    };

  var _glDeleteTextures = (n, textures) => {
      for (var i = 0; i < n; i++) {
        var id = HEAP32[(((textures)+(i*4))>>2)];
        var texture = GL.textures[id];
        // GL spec: "glDeleteTextures silently ignores 0s and names that do not
        // correspond to existing textures".
        if (!texture) continue;
        GLctx.deleteTexture(texture);
        texture.name = 0;
        GL.textures[id] = null;
      }
    };

  var _glDeleteVertexArrays = (n, vaos) => {
      for (var i = 0; i < n; i++) {
        var id = HEAP32[(((vaos)+(i*4))>>2)];
        GLctx.deleteVertexArray(GL.vaos[id]);
        GL.vaos[id] = null;
      }
    };

  
  var _glDeleteVertexArraysOES = _glDeleteVertexArrays;

  var _glDepthMask = (flag) => {
      GLctx.depthMask(!!flag);
    };

  function _glDisable(x0) { GLctx.disable(x0) }

  var _glDisableVertexAttribArray = (index) => {
      GLctx.disableVertexAttribArray(index);
    };

  var _glDrawArrays = (mode, first, count) => {
  
      GLctx.drawArrays(mode, first, count);
  
    };

  var _glDrawArraysInstanced = (mode, first, count, primcount) => {
      GLctx.drawArraysInstanced(mode, first, count, primcount);
    };

  var _glDrawArraysInstancedBaseInstanceWEBGL = (mode, first, count, instanceCount, baseInstance) => {
      GLctx.dibvbi['drawArraysInstancedBaseInstanceWEBGL'](mode, first, count, instanceCount, baseInstance);
    };

  var tempFixedLengthArray = [];
  
  var _glDrawBuffers = (n, bufs) => {
  
      var bufArray = tempFixedLengthArray[n];
      for (var i = 0; i < n; i++) {
        bufArray[i] = HEAP32[(((bufs)+(i*4))>>2)];
      }
  
      GLctx.drawBuffers(bufArray);
    };

  var _glDrawElements = (mode, count, type, indices) => {
  
      GLctx.drawElements(mode, count, type, indices);
  
    };

  var _glDrawElementsInstanced = (mode, count, type, indices, primcount) => {
      GLctx.drawElementsInstanced(mode, count, type, indices, primcount);
    };

  var _glDrawElementsInstancedBaseVertexBaseInstanceWEBGL = (mode, count, type, offset, instanceCount, baseVertex, baseinstance) => {
      GLctx.dibvbi['drawElementsInstancedBaseVertexBaseInstanceWEBGL'](mode, count, type, offset, instanceCount, baseVertex, baseinstance);
    };

  var _glDrawRangeElements = (mode, start, end, count, type, indices) => {
      // TODO: This should be a trivial pass-though function registered at the bottom of this page as
      // glFuncs[6][1] += ' drawRangeElements';
      // but due to https://bugzilla.mozilla.org/show_bug.cgi?id=1202427,
      // we work around by ignoring the range.
      _glDrawElements(mode, count, type, indices);
    };

  function _glEnable(x0) { GLctx.enable(x0) }

  var _glEnableVertexAttribArray = (index) => {
      GLctx.enableVertexAttribArray(index);
    };

  var _glFenceSync = (condition, flags) => {
      var sync = GLctx.fenceSync(condition, flags);
      if (sync) {
        var id = GL.getNewId(GL.syncs);
        sync.name = id;
        GL.syncs[id] = sync;
        return id;
      }
      return 0; // Failed to create a sync object
    };

  function _glFinish() { GLctx.finish() }

  function _glFlush() { GLctx.flush() }

  var _glFramebufferRenderbuffer = (target, attachment, renderbuffertarget, renderbuffer) => {
      GLctx.framebufferRenderbuffer(target, attachment, renderbuffertarget,
                                         GL.renderbuffers[renderbuffer]);
    };

  var _glFramebufferTexture2D = (target, attachment, textarget, texture, level) => {
      GLctx.framebufferTexture2D(target, attachment, textarget,
                                      GL.textures[texture], level);
    };

  function _glFrontFace(x0) { GLctx.frontFace(x0) }

  var __glGenObject = (n, buffers, createFunction, objectTable
      ) => {
      for (var i = 0; i < n; i++) {
        var buffer = GLctx[createFunction]();
        var id = buffer && GL.getNewId(objectTable);
        if (buffer) {
          buffer.name = id;
          objectTable[id] = buffer;
        } else {
          GL.recordError(0x502 /* GL_INVALID_OPERATION */);
        }
        HEAP32[(((buffers)+(i*4))>>2)] = id;
      }
    };
  
  var _glGenBuffers = (n, buffers) => {
      __glGenObject(n, buffers, 'createBuffer', GL.buffers
        );
    };

  
  var _glGenFramebuffers = (n, ids) => {
      __glGenObject(n, ids, 'createFramebuffer', GL.framebuffers
        );
    };

  
  var _glGenRenderbuffers = (n, renderbuffers) => {
      __glGenObject(n, renderbuffers, 'createRenderbuffer', GL.renderbuffers
        );
    };

  var _glGenSamplers = (n, samplers) => {
      __glGenObject(n, samplers, 'createSampler', GL.samplers
        );
    };

  
  var _glGenTextures = (n, textures) => {
      __glGenObject(n, textures, 'createTexture', GL.textures
        );
    };

  
  function _glGenVertexArrays(n, arrays) {
      __glGenObject(n, arrays, 'createVertexArray', GL.vaos
        );
    }

  
  var _glGenVertexArraysOES = _glGenVertexArrays;

  function _glGenerateMipmap(x0) { GLctx.generateMipmap(x0) }

  var _glGetBufferParameteriv = (target, value, data) => {
      if (!data) {
        // GLES2 specification does not specify how to behave if data is a null
        // pointer. Since calling this function does not make sense if data ==
        // null, issue a GL error to notify user about it.
        GL.recordError(0x501 /* GL_INVALID_VALUE */);
        return;
      }
      HEAP32[((data)>>2)] = GLctx.getBufferParameter(target, value);
    };

  var _glGetError = () => {
      var error = GLctx.getError() || GL.lastError;
      GL.lastError = 0/*GL_NO_ERROR*/;
      return error;
    };

  var readI53FromI64 = (ptr) => {
      return HEAPU32[((ptr)>>2)] + HEAP32[(((ptr)+(4))>>2)] * 4294967296;
    };
  
  var readI53FromU64 = (ptr) => {
      return HEAPU32[((ptr)>>2)] + HEAPU32[(((ptr)+(4))>>2)] * 4294967296;
    };
  var writeI53ToI64 = (ptr, num) => {
      HEAPU32[((ptr)>>2)] = num;
      var lower = HEAPU32[((ptr)>>2)];
      HEAPU32[(((ptr)+(4))>>2)] = (num - lower)/4294967296;
      var deserialized = (num >= 0) ? readI53FromU64(ptr) : readI53FromI64(ptr);
      var offset = ((ptr)>>2);
      if (deserialized != num) warnOnce(`writeI53ToI64() out of range: serialized JS Number ${num} to Wasm heap as bytes lo=${ptrToString(HEAPU32[offset])}, hi=${ptrToString(HEAPU32[offset+1])}, which deserializes back to ${deserialized} instead!`);
    };
  
  var emscriptenWebGLGet = (name_, p, type) => {
      // Guard against user passing a null pointer.
      // Note that GLES2 spec does not say anything about how passing a null
      // pointer should be treated.  Testing on desktop core GL 3, the application
      // crashes on glGetIntegerv to a null pointer, but better to report an error
      // instead of doing anything random.
      if (!p) {
        GL.recordError(0x501 /* GL_INVALID_VALUE */);
        return;
      }
      var ret = undefined;
      switch (name_) { // Handle a few trivial GLES values
        case 0x8DFA: // GL_SHADER_COMPILER
          ret = 1;
          break;
        case 0x8DF8: // GL_SHADER_BINARY_FORMATS
          if (type != 0 && type != 1) {
            GL.recordError(0x500); // GL_INVALID_ENUM
          }
          // Do not write anything to the out pointer, since no binary formats are
          // supported.
          return;
        case 0x87FE: // GL_NUM_PROGRAM_BINARY_FORMATS
        case 0x8DF9: // GL_NUM_SHADER_BINARY_FORMATS
          ret = 0;
          break;
        case 0x86A2: // GL_NUM_COMPRESSED_TEXTURE_FORMATS
          // WebGL doesn't have GL_NUM_COMPRESSED_TEXTURE_FORMATS (it's obsolete
          // since GL_COMPRESSED_TEXTURE_FORMATS returns a JS array that can be
          // queried for length), so implement it ourselves to allow C++ GLES2
          // code get the length.
          var formats = GLctx.getParameter(0x86A3 /*GL_COMPRESSED_TEXTURE_FORMATS*/);
          ret = formats ? formats.length : 0;
          break;
  
        case 0x821D: // GL_NUM_EXTENSIONS
          if (GL.currentContext.version < 2) {
            // Calling GLES3/WebGL2 function with a GLES2/WebGL1 context
            GL.recordError(0x502 /* GL_INVALID_OPERATION */);
            return;
          }
          // .getSupportedExtensions() can return null if context is lost, so coerce to empty array.
          var exts = GLctx.getSupportedExtensions() || [];
          // each extension is duplicated, first in unprefixed WebGL form, and
          // then a second time with "GL_" prefix.
          ret = 2 * exts.length;
          break;
        case 0x821B: // GL_MAJOR_VERSION
        case 0x821C: // GL_MINOR_VERSION
          if (GL.currentContext.version < 2) {
            GL.recordError(0x500); // GL_INVALID_ENUM
            return;
          }
          ret = name_ == 0x821B ? 3 : 0; // return version 3.0
          break;
      }
  
      if (ret === undefined) {
        var result = GLctx.getParameter(name_);
        switch (typeof result) {
          case "number":
            ret = result;
            break;
          case "boolean":
            ret = result ? 1 : 0;
            break;
          case "string":
            GL.recordError(0x500); // GL_INVALID_ENUM
            return;
          case "object":
            if (result === null) {
              // null is a valid result for some (e.g., which buffer is bound -
              // perhaps nothing is bound), but otherwise can mean an invalid
              // name_, which we need to report as an error
              switch (name_) {
                case 0x8894: // ARRAY_BUFFER_BINDING
                case 0x8B8D: // CURRENT_PROGRAM
                case 0x8895: // ELEMENT_ARRAY_BUFFER_BINDING
                case 0x8CA6: // FRAMEBUFFER_BINDING or DRAW_FRAMEBUFFER_BINDING
                case 0x8CA7: // RENDERBUFFER_BINDING
                case 0x8069: // TEXTURE_BINDING_2D
                case 0x85B5: // WebGL 2 GL_VERTEX_ARRAY_BINDING, or WebGL 1 extension OES_vertex_array_object GL_VERTEX_ARRAY_BINDING_OES
                case 0x8F36: // COPY_READ_BUFFER_BINDING or COPY_READ_BUFFER
                case 0x8F37: // COPY_WRITE_BUFFER_BINDING or COPY_WRITE_BUFFER
                case 0x88ED: // PIXEL_PACK_BUFFER_BINDING
                case 0x88EF: // PIXEL_UNPACK_BUFFER_BINDING
                case 0x8CAA: // READ_FRAMEBUFFER_BINDING
                case 0x8919: // SAMPLER_BINDING
                case 0x8C1D: // TEXTURE_BINDING_2D_ARRAY
                case 0x806A: // TEXTURE_BINDING_3D
                case 0x8E25: // TRANSFORM_FEEDBACK_BINDING
                case 0x8C8F: // TRANSFORM_FEEDBACK_BUFFER_BINDING
                case 0x8A28: // UNIFORM_BUFFER_BINDING
                case 0x8514: { // TEXTURE_BINDING_CUBE_MAP
                  ret = 0;
                  break;
                }
                default: {
                  GL.recordError(0x500); // GL_INVALID_ENUM
                  return;
                }
              }
            } else if (result instanceof Float32Array ||
                       result instanceof Uint32Array ||
                       result instanceof Int32Array ||
                       result instanceof Array) {
              for (var i = 0; i < result.length; ++i) {
                switch (type) {
                  case 0: HEAP32[(((p)+(i*4))>>2)] = result[i]; break;
                  case 2: HEAPF32[(((p)+(i*4))>>2)] = result[i]; break;
                  case 4: HEAP8[(((p)+(i))>>0)] = result[i] ? 1 : 0; break;
                }
              }
              return;
            } else {
              try {
                ret = result.name | 0;
              } catch(e) {
                GL.recordError(0x500); // GL_INVALID_ENUM
                err(`GL_INVALID_ENUM in glGet${type}v: Unknown object returned from WebGL getParameter(${name_})! (error: ${e})`);
                return;
              }
            }
            break;
          default:
            GL.recordError(0x500); // GL_INVALID_ENUM
            err(`GL_INVALID_ENUM in glGet${type}v: Native code calling glGet${type}v(${name_}) and it returns ${result} of type ${typeof(result)}!`);
            return;
        }
      }
  
      switch (type) {
        case 1: writeI53ToI64(p, ret); break;
        case 0: HEAP32[((p)>>2)] = ret; break;
        case 2:   HEAPF32[((p)>>2)] = ret; break;
        case 4: HEAP8[((p)>>0)] = ret ? 1 : 0; break;
      }
    };
  
  var _glGetFloatv = (name_, p) => emscriptenWebGLGet(name_, p, 2);

  var _glGetFramebufferAttachmentParameteriv = (target, attachment, pname, params) => {
      var result = GLctx.getFramebufferAttachmentParameter(target, attachment, pname);
      if (result instanceof WebGLRenderbuffer ||
          result instanceof WebGLTexture) {
        result = result.name | 0;
      }
      HEAP32[((params)>>2)] = result;
    };

  
  var _glGetIntegerv = (name_, p) => emscriptenWebGLGet(name_, p, 0);

  var _glGetProgramInfoLog = (program, maxLength, length, infoLog) => {
      var log = GLctx.getProgramInfoLog(GL.programs[program]);
      if (log === null) log = '(unknown error)';
      var numBytesWrittenExclNull = (maxLength > 0 && infoLog) ? stringToUTF8(log, infoLog, maxLength) : 0;
      if (length) HEAP32[((length)>>2)] = numBytesWrittenExclNull;
    };

  var _glGetProgramiv = (program, pname, p) => {
      if (!p) {
        // GLES2 specification does not specify how to behave if p is a null
        // pointer. Since calling this function does not make sense if p == null,
        // issue a GL error to notify user about it.
        GL.recordError(0x501 /* GL_INVALID_VALUE */);
        return;
      }
  
      if (program >= GL.counter) {
        GL.recordError(0x501 /* GL_INVALID_VALUE */);
        return;
      }
  
      program = GL.programs[program];
  
      if (pname == 0x8B84) { // GL_INFO_LOG_LENGTH
        var log = GLctx.getProgramInfoLog(program);
        if (log === null) log = '(unknown error)';
        HEAP32[((p)>>2)] = log.length + 1;
      } else if (pname == 0x8B87 /* GL_ACTIVE_UNIFORM_MAX_LENGTH */) {
        if (!program.maxUniformLength) {
          for (var i = 0; i < GLctx.getProgramParameter(program, 0x8B86/*GL_ACTIVE_UNIFORMS*/); ++i) {
            program.maxUniformLength = Math.max(program.maxUniformLength, GLctx.getActiveUniform(program, i).name.length+1);
          }
        }
        HEAP32[((p)>>2)] = program.maxUniformLength;
      } else if (pname == 0x8B8A /* GL_ACTIVE_ATTRIBUTE_MAX_LENGTH */) {
        if (!program.maxAttributeLength) {
          for (var i = 0; i < GLctx.getProgramParameter(program, 0x8B89/*GL_ACTIVE_ATTRIBUTES*/); ++i) {
            program.maxAttributeLength = Math.max(program.maxAttributeLength, GLctx.getActiveAttrib(program, i).name.length+1);
          }
        }
        HEAP32[((p)>>2)] = program.maxAttributeLength;
      } else if (pname == 0x8A35 /* GL_ACTIVE_UNIFORM_BLOCK_MAX_NAME_LENGTH */) {
        if (!program.maxUniformBlockNameLength) {
          for (var i = 0; i < GLctx.getProgramParameter(program, 0x8A36/*GL_ACTIVE_UNIFORM_BLOCKS*/); ++i) {
            program.maxUniformBlockNameLength = Math.max(program.maxUniformBlockNameLength, GLctx.getActiveUniformBlockName(program, i).length+1);
          }
        }
        HEAP32[((p)>>2)] = program.maxUniformBlockNameLength;
      } else {
        HEAP32[((p)>>2)] = GLctx.getProgramParameter(program, pname);
      }
    };

  var _glGetRenderbufferParameteriv = (target, pname, params) => {
      if (!params) {
        // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
        // if params == null, issue a GL error to notify user about it.
        GL.recordError(0x501 /* GL_INVALID_VALUE */);
        return;
      }
      HEAP32[((params)>>2)] = GLctx.getRenderbufferParameter(target, pname);
    };

  
  var _glGetShaderInfoLog = (shader, maxLength, length, infoLog) => {
      var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
      if (log === null) log = '(unknown error)';
      var numBytesWrittenExclNull = (maxLength > 0 && infoLog) ? stringToUTF8(log, infoLog, maxLength) : 0;
      if (length) HEAP32[((length)>>2)] = numBytesWrittenExclNull;
    };

  var _glGetShaderPrecisionFormat = (shaderType, precisionType, range, precision) => {
      var result = GLctx.getShaderPrecisionFormat(shaderType, precisionType);
      HEAP32[((range)>>2)] = result.rangeMin;
      HEAP32[(((range)+(4))>>2)] = result.rangeMax;
      HEAP32[((precision)>>2)] = result.precision;
    };

  var _glGetShaderiv = (shader, pname, p) => {
      if (!p) {
        // GLES2 specification does not specify how to behave if p is a null
        // pointer. Since calling this function does not make sense if p == null,
        // issue a GL error to notify user about it.
        GL.recordError(0x501 /* GL_INVALID_VALUE */);
        return;
      }
      if (pname == 0x8B84) { // GL_INFO_LOG_LENGTH
        var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
        if (log === null) log = '(unknown error)';
        // The GLES2 specification says that if the shader has an empty info log,
        // a value of 0 is returned. Otherwise the log has a null char appended.
        // (An empty string is falsey, so we can just check that instead of
        // looking at log.length.)
        var logLength = log ? log.length + 1 : 0;
        HEAP32[((p)>>2)] = logLength;
      } else if (pname == 0x8B88) { // GL_SHADER_SOURCE_LENGTH
        var source = GLctx.getShaderSource(GL.shaders[shader]);
        // source may be a null, or the empty string, both of which are falsey
        // values that we report a 0 length for.
        var sourceLength = source ? source.length + 1 : 0;
        HEAP32[((p)>>2)] = sourceLength;
      } else {
        HEAP32[((p)>>2)] = GLctx.getShaderParameter(GL.shaders[shader], pname);
      }
    };

  
  
  var stringToNewUTF8 = (str) => {
      var size = lengthBytesUTF8(str) + 1;
      var ret = _malloc(size);
      if (ret) stringToUTF8(str, ret, size);
      return ret;
    };
  
  var _glGetString = (name_) => {
      var ret = GL.stringCache[name_];
      if (!ret) {
        switch (name_) {
          case 0x1F03 /* GL_EXTENSIONS */:
            ret = stringToNewUTF8(GL.getExtensions().join(' '));
            break;
          case 0x1F00 /* GL_VENDOR */:
          case 0x1F01 /* GL_RENDERER */:
          case 0x9245 /* UNMASKED_VENDOR_WEBGL */:
          case 0x9246 /* UNMASKED_RENDERER_WEBGL */:
            var s = GLctx.getParameter(name_);
            if (!s) {
              GL.recordError(0x500/*GL_INVALID_ENUM*/);
            }
            ret = s ? stringToNewUTF8(s) : 0;
            break;
  
          case 0x1F02 /* GL_VERSION */:
            var glVersion = GLctx.getParameter(0x1F02 /*GL_VERSION*/);
            // return GLES version string corresponding to the version of the WebGL context
            if (true) glVersion = `OpenGL ES 3.0 (${glVersion})`;
            else
            {
              glVersion = `OpenGL ES 2.0 (${glVersion})`;
            }
            ret = stringToNewUTF8(glVersion);
            break;
          case 0x8B8C /* GL_SHADING_LANGUAGE_VERSION */:
            var glslVersion = GLctx.getParameter(0x8B8C /*GL_SHADING_LANGUAGE_VERSION*/);
            // extract the version number 'N.M' from the string 'WebGL GLSL ES N.M ...'
            var ver_re = /^WebGL GLSL ES ([0-9]\.[0-9][0-9]?)(?:$| .*)/;
            var ver_num = glslVersion.match(ver_re);
            if (ver_num !== null) {
              if (ver_num[1].length == 3) ver_num[1] = ver_num[1] + '0'; // ensure minor version has 2 digits
              glslVersion = `OpenGL ES GLSL ES ${ver_num[1]} (${glslVersion})`;
            }
            ret = stringToNewUTF8(glslVersion);
            break;
          default:
            GL.recordError(0x500/*GL_INVALID_ENUM*/);
            // fall through
        }
        GL.stringCache[name_] = ret;
      }
      return ret;
    };

  var _glGetStringi = (name, index) => {
      if (GL.currentContext.version < 2) {
        GL.recordError(0x502 /* GL_INVALID_OPERATION */); // Calling GLES3/WebGL2 function with a GLES2/WebGL1 context
        return 0;
      }
      var stringiCache = GL.stringiCache[name];
      if (stringiCache) {
        if (index < 0 || index >= stringiCache.length) {
          GL.recordError(0x501/*GL_INVALID_VALUE*/);
          return 0;
        }
        return stringiCache[index];
      }
      switch (name) {
        case 0x1F03 /* GL_EXTENSIONS */:
          var exts = GL.getExtensions().map((e) => stringToNewUTF8(e));
          stringiCache = GL.stringiCache[name] = exts;
          if (index < 0 || index >= stringiCache.length) {
            GL.recordError(0x501/*GL_INVALID_VALUE*/);
            return 0;
          }
          return stringiCache[index];
        default:
          GL.recordError(0x500/*GL_INVALID_ENUM*/);
          return 0;
      }
    };

  /** @suppress {checkTypes} */
  var jstoi_q = (str) => parseInt(str);
  
  /** @noinline */
  var webglGetLeftBracePos = (name) => name.slice(-1) == ']' && name.lastIndexOf('[');
  
  var webglPrepareUniformLocationsBeforeFirstUse = (program) => {
      var uniformLocsById = program.uniformLocsById, // Maps GLuint -> WebGLUniformLocation
        uniformSizeAndIdsByName = program.uniformSizeAndIdsByName, // Maps name -> [uniform array length, GLuint]
        i, j;
  
      // On the first time invocation of glGetUniformLocation on this shader program:
      // initialize cache data structures and discover which uniforms are arrays.
      if (!uniformLocsById) {
        // maps GLint integer locations to WebGLUniformLocations
        program.uniformLocsById = uniformLocsById = {};
        // maps integer locations back to uniform name strings, so that we can lazily fetch uniform array locations
        program.uniformArrayNamesById = {};
  
        for (i = 0; i < GLctx.getProgramParameter(program, 0x8B86/*GL_ACTIVE_UNIFORMS*/); ++i) {
          var u = GLctx.getActiveUniform(program, i);
          var nm = u.name;
          var sz = u.size;
          var lb = webglGetLeftBracePos(nm);
          var arrayName = lb > 0 ? nm.slice(0, lb) : nm;
  
          // Assign a new location.
          var id = program.uniformIdCounter;
          program.uniformIdCounter += sz;
          // Eagerly get the location of the uniformArray[0] base element.
          // The remaining indices >0 will be left for lazy evaluation to
          // improve performance. Those may never be needed to fetch, if the
          // application fills arrays always in full starting from the first
          // element of the array.
          uniformSizeAndIdsByName[arrayName] = [sz, id];
  
          // Store placeholder integers in place that highlight that these
          // >0 index locations are array indices pending population.
          for (j = 0; j < sz; ++j) {
            uniformLocsById[id] = j;
            program.uniformArrayNamesById[id++] = arrayName;
          }
        }
      }
    };
  
  
  
  var _glGetUniformLocation = (program, name) => {
  
      name = UTF8ToString(name);
  
      if (program = GL.programs[program]) {
        webglPrepareUniformLocationsBeforeFirstUse(program);
        var uniformLocsById = program.uniformLocsById; // Maps GLuint -> WebGLUniformLocation
        var arrayIndex = 0;
        var uniformBaseName = name;
  
        // Invariant: when populating integer IDs for uniform locations, we must
        // maintain the precondition that arrays reside in contiguous addresses,
        // i.e. for a 'vec4 colors[10];', colors[4] must be at location
        // colors[0]+4.  However, user might call glGetUniformLocation(program,
        // "colors") for an array, so we cannot discover based on the user input
        // arguments whether the uniform we are dealing with is an array. The only
        // way to discover which uniforms are arrays is to enumerate over all the
        // active uniforms in the program.
        var leftBrace = webglGetLeftBracePos(name);
  
        // If user passed an array accessor "[index]", parse the array index off the accessor.
        if (leftBrace > 0) {
          arrayIndex = jstoi_q(name.slice(leftBrace + 1)) >>> 0; // "index]", coerce parseInt(']') with >>>0 to treat "foo[]" as "foo[0]" and foo[-1] as unsigned out-of-bounds.
          uniformBaseName = name.slice(0, leftBrace);
        }
  
        // Have we cached the location of this uniform before?
        // A pair [array length, GLint of the uniform location]
        var sizeAndId = program.uniformSizeAndIdsByName[uniformBaseName];
  
        // If an uniform with this name exists, and if its index is within the
        // array limits (if it's even an array), query the WebGLlocation, or
        // return an existing cached location.
        if (sizeAndId && arrayIndex < sizeAndId[0]) {
          arrayIndex += sizeAndId[1]; // Add the base location of the uniform to the array index offset.
          if ((uniformLocsById[arrayIndex] = uniformLocsById[arrayIndex] || GLctx.getUniformLocation(program, name))) {
            return arrayIndex;
          }
        }
      }
      else {
        // N.b. we are currently unable to distinguish between GL program IDs that
        // never existed vs GL program IDs that have been deleted, so report
        // GL_INVALID_VALUE in both cases.
        GL.recordError(0x501 /* GL_INVALID_VALUE */);
      }
      return -1;
    };

  var _glInvalidateFramebuffer = (target, numAttachments, attachments) => {
      var list = tempFixedLengthArray[numAttachments];
      for (var i = 0; i < numAttachments; i++) {
        list[i] = HEAP32[(((attachments)+(i*4))>>2)];
      }
  
      GLctx.invalidateFramebuffer(target, list);
    };

  var _glInvalidateSubFramebuffer = (target, numAttachments, attachments, x, y, width, height) => {
      var list = tempFixedLengthArray[numAttachments];
      for (var i = 0; i < numAttachments; i++) {
        list[i] = HEAP32[(((attachments)+(i*4))>>2)];
      }
  
      GLctx.invalidateSubFramebuffer(target, list, x, y, width, height);
    };

  var _glIsSync = (sync) => GLctx.isSync(GL.syncs[sync]);

  var _glIsTexture = (id) => {
      var texture = GL.textures[id];
      if (!texture) return 0;
      return GLctx.isTexture(texture);
    };

  function _glLineWidth(x0) { GLctx.lineWidth(x0) }

  var _glLinkProgram = (program) => {
      program = GL.programs[program];
      GLctx.linkProgram(program);
      // Invalidate earlier computed uniform->ID mappings, those have now become stale
      program.uniformLocsById = 0; // Mark as null-like so that glGetUniformLocation() knows to populate this again.
      program.uniformSizeAndIdsByName = {};
  
    };

  var _glMultiDrawArraysInstancedBaseInstanceWEBGL = (mode, firsts, counts, instanceCounts, baseInstances, drawCount) => {
      GLctx.mdibvbi['multiDrawArraysInstancedBaseInstanceWEBGL'](
        mode,
        HEAP32,
        firsts >> 2,
        HEAP32,
        counts >> 2,
        HEAP32,
        instanceCounts >> 2,
        HEAPU32,
        baseInstances >> 2,
        drawCount);
    };

  var _glMultiDrawElementsInstancedBaseVertexBaseInstanceWEBGL = (mode, counts, type, offsets, instanceCounts, baseVertices, baseInstances, drawCount) => {
      GLctx.mdibvbi['multiDrawElementsInstancedBaseVertexBaseInstanceWEBGL'](
        mode,
        HEAP32,
        counts >> 2,
        type,
        HEAP32,
        offsets >> 2,
        HEAP32,
        instanceCounts >> 2,
        HEAP32,
        baseVertices >> 2,
        HEAPU32,
        baseInstances >> 2,
        drawCount);
    };

  var _glPixelStorei = (pname, param) => {
      if (pname == 0xCF5 /* GL_UNPACK_ALIGNMENT */) {
        GL.unpackAlignment = param;
      }
      GLctx.pixelStorei(pname, param);
    };

  function _glReadBuffer(x0) { GLctx.readBuffer(x0) }

  var computeUnpackAlignedImageSize = (width, height, sizePerPixel, alignment) => {
      function roundedToNextMultipleOf(x, y) {
        return (x + y - 1) & -y;
      }
      var plainRowSize = width * sizePerPixel;
      var alignedRowSize = roundedToNextMultipleOf(plainRowSize, alignment);
      return height * alignedRowSize;
    };
  
  var colorChannelsInGlTextureFormat = (format) => {
      // Micro-optimizations for size: map format to size by subtracting smallest
      // enum value (0x1902) from all values first.  Also omit the most common
      // size value (1) from the list, which is assumed by formats not on the
      // list.
      var colorChannels = {
        // 0x1902 /* GL_DEPTH_COMPONENT */ - 0x1902: 1,
        // 0x1906 /* GL_ALPHA */ - 0x1902: 1,
        5: 3,
        6: 4,
        // 0x1909 /* GL_LUMINANCE */ - 0x1902: 1,
        8: 2,
        29502: 3,
        29504: 4,
        // 0x1903 /* GL_RED */ - 0x1902: 1,
        26917: 2,
        26918: 2,
        // 0x8D94 /* GL_RED_INTEGER */ - 0x1902: 1,
        29846: 3,
        29847: 4
      };
      return colorChannels[format - 0x1902]||1;
    };
  
  var heapObjectForWebGLType = (type) => {
      // Micro-optimization for size: Subtract lowest GL enum number (0x1400/* GL_BYTE */) from type to compare
      // smaller values for the heap, for shorter generated code size.
      // Also the type HEAPU16 is not tested for explicitly, but any unrecognized type will return out HEAPU16.
      // (since most types are HEAPU16)
      type -= 0x1400;
      if (type == 0) return HEAP8;
  
      if (type == 1) return HEAPU8;
  
      if (type == 2) return HEAP16;
  
      if (type == 4) return HEAP32;
  
      if (type == 6) return HEAPF32;
  
      if (type == 5
        || type == 28922
        || type == 28520
        || type == 30779
        || type == 30782
        )
        return HEAPU32;
  
      return HEAPU16;
    };
  
  var heapAccessShiftForWebGLHeap = (heap) => 31 - Math.clz32(heap.BYTES_PER_ELEMENT);
  
  var emscriptenWebGLGetTexPixelData = (type, format, width, height, pixels, internalFormat) => {
      var heap = heapObjectForWebGLType(type);
      var shift = heapAccessShiftForWebGLHeap(heap);
      var byteSize = 1<<shift;
      var sizePerPixel = colorChannelsInGlTextureFormat(format) * byteSize;
      var bytes = computeUnpackAlignedImageSize(width, height, sizePerPixel, GL.unpackAlignment);
      return heap.subarray(pixels >> shift, pixels + bytes >> shift);
    };
  
  
  
  var _glReadPixels = (x, y, width, height, format, type, pixels) => {
      if (true) {
        // WebGL 2 provides new garbage-free entry points to call to WebGL. Use
        // those always when possible.
        if (GLctx.currentPixelPackBufferBinding) {
          GLctx.readPixels(x, y, width, height, format, type, pixels);
        } else {
          var heap = heapObjectForWebGLType(type);
          GLctx.readPixels(x, y, width, height, format, type, heap, pixels >> heapAccessShiftForWebGLHeap(heap));
        }
        return;
      }
      var pixelData = emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, format);
      if (!pixelData) {
        GL.recordError(0x500/*GL_INVALID_ENUM*/);
        return;
      }
      GLctx.readPixels(x, y, width, height, format, type, pixelData);
    };

  function _glRenderbufferStorage(x0, x1, x2, x3) { GLctx.renderbufferStorage(x0, x1, x2, x3) }

  function _glRenderbufferStorageMultisample(x0, x1, x2, x3, x4) { GLctx.renderbufferStorageMultisample(x0, x1, x2, x3, x4) }

  var _glSamplerParameterf = (sampler, pname, param) => {
      GLctx.samplerParameterf(GL.samplers[sampler], pname, param);
    };

  var _glSamplerParameteri = (sampler, pname, param) => {
      GLctx.samplerParameteri(GL.samplers[sampler], pname, param);
    };

  var _glSamplerParameteriv = (sampler, pname, params) => {
      var param = HEAP32[((params)>>2)];
      GLctx.samplerParameteri(GL.samplers[sampler], pname, param);
    };

  function _glScissor(x0, x1, x2, x3) { GLctx.scissor(x0, x1, x2, x3) }

  var _glShaderSource = (shader, count, string, length) => {
      var source = GL.getSource(shader, count, string, length);
  
      GLctx.shaderSource(GL.shaders[shader], source);
    };

  function _glStencilFunc(x0, x1, x2) { GLctx.stencilFunc(x0, x1, x2) }

  function _glStencilFuncSeparate(x0, x1, x2, x3) { GLctx.stencilFuncSeparate(x0, x1, x2, x3) }

  function _glStencilMask(x0) { GLctx.stencilMask(x0) }

  function _glStencilMaskSeparate(x0, x1) { GLctx.stencilMaskSeparate(x0, x1) }

  function _glStencilOp(x0, x1, x2) { GLctx.stencilOp(x0, x1, x2) }

  function _glStencilOpSeparate(x0, x1, x2, x3) { GLctx.stencilOpSeparate(x0, x1, x2, x3) }

  
  
  
  var _glTexImage2D = (target, level, internalFormat, width, height, border, format, type, pixels) => {
      if (true) {
        // WebGL 2 provides new garbage-free entry points to call to WebGL. Use
        // those always when possible.
        if (GLctx.currentPixelUnpackBufferBinding) {
          GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixels);
        } else if (pixels) {
          var heap = heapObjectForWebGLType(type);
          GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, heap, pixels >> heapAccessShiftForWebGLHeap(heap));
        } else {
          GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, null);
        }
        return;
      }
      GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixels ? emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, internalFormat) : null);
    };

  function _glTexParameterf(x0, x1, x2) { GLctx.texParameterf(x0, x1, x2) }

  var _glTexParameterfv = (target, pname, params) => {
      var param = HEAPF32[((params)>>2)];
      GLctx.texParameterf(target, pname, param);
    };

  function _glTexParameteri(x0, x1, x2) { GLctx.texParameteri(x0, x1, x2) }

  var _glTexParameteriv = (target, pname, params) => {
      var param = HEAP32[((params)>>2)];
      GLctx.texParameteri(target, pname, param);
    };

  function _glTexStorage2D(x0, x1, x2, x3, x4) { GLctx.texStorage2D(x0, x1, x2, x3, x4) }

  
  
  
  var _glTexSubImage2D = (target, level, xoffset, yoffset, width, height, format, type, pixels) => {
      if (true) {
        // WebGL 2 provides new garbage-free entry points to call to WebGL. Use
        // those always when possible.
        if (GLctx.currentPixelUnpackBufferBinding) {
          GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixels);
        } else if (pixels) {
          var heap = heapObjectForWebGLType(type);
          GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, heap, pixels >> heapAccessShiftForWebGLHeap(heap));
        } else {
          GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, null);
        }
        return;
      }
      var pixelData = null;
      if (pixels) pixelData = emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, 0);
      GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixelData);
    };

  var webglGetUniformLocation = (location) => {
      var p = GLctx.currentProgram;
  
      if (p) {
        var webglLoc = p.uniformLocsById[location];
        // p.uniformLocsById[location] stores either an integer, or a
        // WebGLUniformLocation.
        // If an integer, we have not yet bound the location, so do it now. The
        // integer value specifies the array index we should bind to.
        if (typeof webglLoc == 'number') {
          p.uniformLocsById[location] = webglLoc = GLctx.getUniformLocation(p, p.uniformArrayNamesById[location] + (webglLoc > 0 ? `[${webglLoc}]` : ''));
        }
        // Else an already cached WebGLUniformLocation, return it.
        return webglLoc;
      } else {
        GL.recordError(0x502/*GL_INVALID_OPERATION*/);
      }
    };
  
  var _glUniform1f = (location, v0) => {
      GLctx.uniform1f(webglGetUniformLocation(location), v0);
    };

  
  var _glUniform1fv = (location, count, value) => {
  
      count && GLctx.uniform1fv(webglGetUniformLocation(location), HEAPF32, value>>2, count);
    };

  
  var _glUniform1i = (location, v0) => {
      GLctx.uniform1i(webglGetUniformLocation(location), v0);
    };

  
  var _glUniform1iv = (location, count, value) => {
  
      count && GLctx.uniform1iv(webglGetUniformLocation(location), HEAP32, value>>2, count);
    };

  
  var _glUniform2f = (location, v0, v1) => {
      GLctx.uniform2f(webglGetUniformLocation(location), v0, v1);
    };

  
  var _glUniform2fv = (location, count, value) => {
  
      count && GLctx.uniform2fv(webglGetUniformLocation(location), HEAPF32, value>>2, count*2);
    };

  
  var _glUniform2i = (location, v0, v1) => {
      GLctx.uniform2i(webglGetUniformLocation(location), v0, v1);
    };

  
  var _glUniform2iv = (location, count, value) => {
  
      count && GLctx.uniform2iv(webglGetUniformLocation(location), HEAP32, value>>2, count*2);
    };

  
  var _glUniform3f = (location, v0, v1, v2) => {
      GLctx.uniform3f(webglGetUniformLocation(location), v0, v1, v2);
    };

  
  var _glUniform3fv = (location, count, value) => {
  
      count && GLctx.uniform3fv(webglGetUniformLocation(location), HEAPF32, value>>2, count*3);
    };

  
  var _glUniform3i = (location, v0, v1, v2) => {
      GLctx.uniform3i(webglGetUniformLocation(location), v0, v1, v2);
    };

  
  var _glUniform3iv = (location, count, value) => {
  
      count && GLctx.uniform3iv(webglGetUniformLocation(location), HEAP32, value>>2, count*3);
    };

  
  var _glUniform4f = (location, v0, v1, v2, v3) => {
      GLctx.uniform4f(webglGetUniformLocation(location), v0, v1, v2, v3);
    };

  
  var _glUniform4fv = (location, count, value) => {
  
      count && GLctx.uniform4fv(webglGetUniformLocation(location), HEAPF32, value>>2, count*4);
    };

  
  var _glUniform4i = (location, v0, v1, v2, v3) => {
      GLctx.uniform4i(webglGetUniformLocation(location), v0, v1, v2, v3);
    };

  
  var _glUniform4iv = (location, count, value) => {
  
      count && GLctx.uniform4iv(webglGetUniformLocation(location), HEAP32, value>>2, count*4);
    };

  
  var _glUniformMatrix2fv = (location, count, transpose, value) => {
  
      count && GLctx.uniformMatrix2fv(webglGetUniformLocation(location), !!transpose, HEAPF32, value>>2, count*4);
    };

  
  var _glUniformMatrix3fv = (location, count, transpose, value) => {
  
      count && GLctx.uniformMatrix3fv(webglGetUniformLocation(location), !!transpose, HEAPF32, value>>2, count*9);
    };

  
  var _glUniformMatrix4fv = (location, count, transpose, value) => {
  
      count && GLctx.uniformMatrix4fv(webglGetUniformLocation(location), !!transpose, HEAPF32, value>>2, count*16);
    };

  var _glUseProgram = (program) => {
      program = GL.programs[program];
      GLctx.useProgram(program);
      // Record the currently active program so that we can access the uniform
      // mapping table of that program.
      GLctx.currentProgram = program;
    };

  function _glVertexAttrib1f(x0, x1) { GLctx.vertexAttrib1f(x0, x1) }

  var _glVertexAttrib2fv = (index, v) => {
  
      GLctx.vertexAttrib2f(index, HEAPF32[v>>2], HEAPF32[v+4>>2]);
    };

  var _glVertexAttrib3fv = (index, v) => {
  
      GLctx.vertexAttrib3f(index, HEAPF32[v>>2], HEAPF32[v+4>>2], HEAPF32[v+8>>2]);
    };

  var _glVertexAttrib4fv = (index, v) => {
  
      GLctx.vertexAttrib4f(index, HEAPF32[v>>2], HEAPF32[v+4>>2], HEAPF32[v+8>>2], HEAPF32[v+12>>2]);
    };

  var _glVertexAttribDivisor = (index, divisor) => {
      GLctx.vertexAttribDivisor(index, divisor);
    };

  var _glVertexAttribIPointer = (index, size, type, stride, ptr) => {
      GLctx.vertexAttribIPointer(index, size, type, stride, ptr);
    };

  var _glVertexAttribPointer = (index, size, type, normalized, stride, ptr) => {
      GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr);
    };

  function _glViewport(x0, x1, x2, x3) { GLctx.viewport(x0, x1, x2, x3) }

  var _glWaitSync = (sync, flags, timeout_low, timeout_high) => {
      // See WebGL2 vs GLES3 difference on GL_TIMEOUT_IGNORED above (https://www.khronos.org/registry/webgl/specs/latest/2.0/#5.15)
      var timeout = convertI32PairToI53(timeout_low, timeout_high);
      GLctx.waitSync(GL.syncs[sync], flags, timeout);
    };

  var isLeapYear = (year) => year%4 === 0 && (year%100 !== 0 || year%400 === 0);
  
  var arraySum = (array, index) => {
      var sum = 0;
      for (var i = 0; i <= index; sum += array[i++]) {
        // no-op
      }
      return sum;
    };
  
  
  var MONTH_DAYS_LEAP = [31,29,31,30,31,30,31,31,30,31,30,31];
  
  var MONTH_DAYS_REGULAR = [31,28,31,30,31,30,31,31,30,31,30,31];
  var addDays = (date, days) => {
      var newDate = new Date(date.getTime());
      while (days > 0) {
        var leap = isLeapYear(newDate.getFullYear());
        var currentMonth = newDate.getMonth();
        var daysInCurrentMonth = (leap ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR)[currentMonth];
  
        if (days > daysInCurrentMonth-newDate.getDate()) {
          // we spill over to next month
          days -= (daysInCurrentMonth-newDate.getDate()+1);
          newDate.setDate(1);
          if (currentMonth < 11) {
            newDate.setMonth(currentMonth+1)
          } else {
            newDate.setMonth(0);
            newDate.setFullYear(newDate.getFullYear()+1);
          }
        } else {
          // we stay in current month
          newDate.setDate(newDate.getDate()+days);
          return newDate;
        }
      }
  
      return newDate;
    };
  
  
  
  
  var writeArrayToMemory = (array, buffer) => {
      assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
      HEAP8.set(array, buffer);
    };
  
  var _strftime = (s, maxsize, format, tm) => {
      // size_t strftime(char *restrict s, size_t maxsize, const char *restrict format, const struct tm *restrict timeptr);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/strftime.html
  
      var tm_zone = HEAPU32[(((tm)+(40))>>2)];
  
      var date = {
        tm_sec: HEAP32[((tm)>>2)],
        tm_min: HEAP32[(((tm)+(4))>>2)],
        tm_hour: HEAP32[(((tm)+(8))>>2)],
        tm_mday: HEAP32[(((tm)+(12))>>2)],
        tm_mon: HEAP32[(((tm)+(16))>>2)],
        tm_year: HEAP32[(((tm)+(20))>>2)],
        tm_wday: HEAP32[(((tm)+(24))>>2)],
        tm_yday: HEAP32[(((tm)+(28))>>2)],
        tm_isdst: HEAP32[(((tm)+(32))>>2)],
        tm_gmtoff: HEAP32[(((tm)+(36))>>2)],
        tm_zone: tm_zone ? UTF8ToString(tm_zone) : ''
      };
      
  
      var pattern = UTF8ToString(format);
  
      // expand format
      var EXPANSION_RULES_1 = {
        '%c': '%a %b %d %H:%M:%S %Y',     // Replaced by the locale's appropriate date and time representation - e.g., Mon Aug  3 14:02:01 2013
        '%D': '%m/%d/%y',                 // Equivalent to %m / %d / %y
        '%F': '%Y-%m-%d',                 // Equivalent to %Y - %m - %d
        '%h': '%b',                       // Equivalent to %b
        '%r': '%I:%M:%S %p',              // Replaced by the time in a.m. and p.m. notation
        '%R': '%H:%M',                    // Replaced by the time in 24-hour notation
        '%T': '%H:%M:%S',                 // Replaced by the time
        '%x': '%m/%d/%y',                 // Replaced by the locale's appropriate date representation
        '%X': '%H:%M:%S',                 // Replaced by the locale's appropriate time representation
        // Modified Conversion Specifiers
        '%Ec': '%c',                      // Replaced by the locale's alternative appropriate date and time representation.
        '%EC': '%C',                      // Replaced by the name of the base year (period) in the locale's alternative representation.
        '%Ex': '%m/%d/%y',                // Replaced by the locale's alternative date representation.
        '%EX': '%H:%M:%S',                // Replaced by the locale's alternative time representation.
        '%Ey': '%y',                      // Replaced by the offset from %EC (year only) in the locale's alternative representation.
        '%EY': '%Y',                      // Replaced by the full alternative year representation.
        '%Od': '%d',                      // Replaced by the day of the month, using the locale's alternative numeric symbols, filled as needed with leading zeros if there is any alternative symbol for zero; otherwise, with leading <space> characters.
        '%Oe': '%e',                      // Replaced by the day of the month, using the locale's alternative numeric symbols, filled as needed with leading <space> characters.
        '%OH': '%H',                      // Replaced by the hour (24-hour clock) using the locale's alternative numeric symbols.
        '%OI': '%I',                      // Replaced by the hour (12-hour clock) using the locale's alternative numeric symbols.
        '%Om': '%m',                      // Replaced by the month using the locale's alternative numeric symbols.
        '%OM': '%M',                      // Replaced by the minutes using the locale's alternative numeric symbols.
        '%OS': '%S',                      // Replaced by the seconds using the locale's alternative numeric symbols.
        '%Ou': '%u',                      // Replaced by the weekday as a number in the locale's alternative representation (Monday=1).
        '%OU': '%U',                      // Replaced by the week number of the year (Sunday as the first day of the week, rules corresponding to %U ) using the locale's alternative numeric symbols.
        '%OV': '%V',                      // Replaced by the week number of the year (Monday as the first day of the week, rules corresponding to %V ) using the locale's alternative numeric symbols.
        '%Ow': '%w',                      // Replaced by the number of the weekday (Sunday=0) using the locale's alternative numeric symbols.
        '%OW': '%W',                      // Replaced by the week number of the year (Monday as the first day of the week) using the locale's alternative numeric symbols.
        '%Oy': '%y',                      // Replaced by the year (offset from %C ) using the locale's alternative numeric symbols.
      };
      for (var rule in EXPANSION_RULES_1) {
        pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_1[rule]);
      }
  
      var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
      function leadingSomething(value, digits, character) {
        var str = typeof value == 'number' ? value.toString() : (value || '');
        while (str.length < digits) {
          str = character[0]+str;
        }
        return str;
      }
  
      function leadingNulls(value, digits) {
        return leadingSomething(value, digits, '0');
      }
  
      function compareByDay(date1, date2) {
        function sgn(value) {
          return value < 0 ? -1 : (value > 0 ? 1 : 0);
        }
  
        var compare;
        if ((compare = sgn(date1.getFullYear()-date2.getFullYear())) === 0) {
          if ((compare = sgn(date1.getMonth()-date2.getMonth())) === 0) {
            compare = sgn(date1.getDate()-date2.getDate());
          }
        }
        return compare;
      }
  
      function getFirstWeekStartDate(janFourth) {
          switch (janFourth.getDay()) {
            case 0: // Sunday
              return new Date(janFourth.getFullYear()-1, 11, 29);
            case 1: // Monday
              return janFourth;
            case 2: // Tuesday
              return new Date(janFourth.getFullYear(), 0, 3);
            case 3: // Wednesday
              return new Date(janFourth.getFullYear(), 0, 2);
            case 4: // Thursday
              return new Date(janFourth.getFullYear(), 0, 1);
            case 5: // Friday
              return new Date(janFourth.getFullYear()-1, 11, 31);
            case 6: // Saturday
              return new Date(janFourth.getFullYear()-1, 11, 30);
          }
      }
  
      function getWeekBasedYear(date) {
          var thisDate = addDays(new Date(date.tm_year+1900, 0, 1), date.tm_yday);
  
          var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
          var janFourthNextYear = new Date(thisDate.getFullYear()+1, 0, 4);
  
          var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
          var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
  
          if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
            // this date is after the start of the first week of this year
            if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
              return thisDate.getFullYear()+1;
            }
            return thisDate.getFullYear();
          }
          return thisDate.getFullYear()-1;
      }
  
      var EXPANSION_RULES_2 = {
        '%a': (date) => WEEKDAYS[date.tm_wday].substring(0,3) ,
        '%A': (date) => WEEKDAYS[date.tm_wday],
        '%b': (date) => MONTHS[date.tm_mon].substring(0,3),
        '%B': (date) => MONTHS[date.tm_mon],
        '%C': (date) => {
          var year = date.tm_year+1900;
          return leadingNulls((year/100)|0,2);
        },
        '%d': (date) => leadingNulls(date.tm_mday, 2),
        '%e': (date) => leadingSomething(date.tm_mday, 2, ' '),
        '%g': (date) => {
          // %g, %G, and %V give values according to the ISO 8601:2000 standard week-based year.
          // In this system, weeks begin on a Monday and week 1 of the year is the week that includes
          // January 4th, which is also the week that includes the first Thursday of the year, and
          // is also the first week that contains at least four days in the year.
          // If the first Monday of January is the 2nd, 3rd, or 4th, the preceding days are part of
          // the last week of the preceding year; thus, for Saturday 2nd January 1999,
          // %G is replaced by 1998 and %V is replaced by 53. If December 29th, 30th,
          // or 31st is a Monday, it and any following days are part of week 1 of the following year.
          // Thus, for Tuesday 30th December 1997, %G is replaced by 1998 and %V is replaced by 01.
  
          return getWeekBasedYear(date).toString().substring(2);
        },
        '%G': (date) => getWeekBasedYear(date),
        '%H': (date) => leadingNulls(date.tm_hour, 2),
        '%I': (date) => {
          var twelveHour = date.tm_hour;
          if (twelveHour == 0) twelveHour = 12;
          else if (twelveHour > 12) twelveHour -= 12;
          return leadingNulls(twelveHour, 2);
        },
        '%j': (date) => {
          // Day of the year (001-366)
          return leadingNulls(date.tm_mday + arraySum(isLeapYear(date.tm_year+1900) ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR, date.tm_mon-1), 3);
        },
        '%m': (date) => leadingNulls(date.tm_mon+1, 2),
        '%M': (date) => leadingNulls(date.tm_min, 2),
        '%n': () => '\n',
        '%p': (date) => {
          if (date.tm_hour >= 0 && date.tm_hour < 12) {
            return 'AM';
          }
          return 'PM';
        },
        '%S': (date) => leadingNulls(date.tm_sec, 2),
        '%t': () => '\t',
        '%u': (date) => date.tm_wday || 7,
        '%U': (date) => {
          var days = date.tm_yday + 7 - date.tm_wday;
          return leadingNulls(Math.floor(days / 7), 2);
        },
        '%V': (date) => {
          // Replaced by the week number of the year (Monday as the first day of the week)
          // as a decimal number [01,53]. If the week containing 1 January has four
          // or more days in the new year, then it is considered week 1.
          // Otherwise, it is the last week of the previous year, and the next week is week 1.
          // Both January 4th and the first Thursday of January are always in week 1. [ tm_year, tm_wday, tm_yday]
          var val = Math.floor((date.tm_yday + 7 - (date.tm_wday + 6) % 7 ) / 7);
          // If 1 Jan is just 1-3 days past Monday, the previous week
          // is also in this year.
          if ((date.tm_wday + 371 - date.tm_yday - 2) % 7 <= 2) {
            val++;
          }
          if (!val) {
            val = 52;
            // If 31 December of prev year a Thursday, or Friday of a
            // leap year, then the prev year has 53 weeks.
            var dec31 = (date.tm_wday + 7 - date.tm_yday - 1) % 7;
            if (dec31 == 4 || (dec31 == 5 && isLeapYear(date.tm_year%400-1))) {
              val++;
            }
          } else if (val == 53) {
            // If 1 January is not a Thursday, and not a Wednesday of a
            // leap year, then this year has only 52 weeks.
            var jan1 = (date.tm_wday + 371 - date.tm_yday) % 7;
            if (jan1 != 4 && (jan1 != 3 || !isLeapYear(date.tm_year)))
              val = 1;
          }
          return leadingNulls(val, 2);
        },
        '%w': (date) => date.tm_wday,
        '%W': (date) => {
          var days = date.tm_yday + 7 - ((date.tm_wday + 6) % 7);
          return leadingNulls(Math.floor(days / 7), 2);
        },
        '%y': (date) => {
          // Replaced by the last two digits of the year as a decimal number [00,99]. [ tm_year]
          return (date.tm_year+1900).toString().substring(2);
        },
        // Replaced by the year as a decimal number (for example, 1997). [ tm_year]
        '%Y': (date) => date.tm_year+1900,
        '%z': (date) => {
          // Replaced by the offset from UTC in the ISO 8601:2000 standard format ( +hhmm or -hhmm ).
          // For example, "-0430" means 4 hours 30 minutes behind UTC (west of Greenwich).
          var off = date.tm_gmtoff;
          var ahead = off >= 0;
          off = Math.abs(off) / 60;
          // convert from minutes into hhmm format (which means 60 minutes = 100 units)
          off = (off / 60)*100 + (off % 60);
          return (ahead ? '+' : '-') + String("0000" + off).slice(-4);
        },
        '%Z': (date) => date.tm_zone,
        '%%': () => '%'
      };
  
      // Replace %% with a pair of NULLs (which cannot occur in a C string), then
      // re-inject them after processing.
      pattern = pattern.replace(/%%/g, '\0\0')
      for (var rule in EXPANSION_RULES_2) {
        if (pattern.includes(rule)) {
          pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_2[rule](date));
        }
      }
      pattern = pattern.replace(/\0\0/g, '%')
  
      var bytes = intArrayFromString(pattern, false);
      if (bytes.length > maxsize) {
        return 0;
      }
  
      writeArrayToMemory(bytes, s);
      return bytes.length-1;
    };
  var _strftime_l = (s, maxsize, format, tm, loc) => {
      return _strftime(s, maxsize, format, tm); // no locale support yet
    };

  var wasmTableMirror = [];
  
  var wasmTable;
  var getWasmTableEntry = (funcPtr) => {
      var func = wasmTableMirror[funcPtr];
      if (!func) {
        if (funcPtr >= wasmTableMirror.length) wasmTableMirror.length = funcPtr + 1;
        wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
      }
      assert(wasmTable.get(funcPtr) == func, "JavaScript-side Wasm function table mirror is out of date!");
      return func;
    };

  var FSNode = /** @constructor */ function(parent, name, mode, rdev) {
    if (!parent) {
      parent = this;  // root node sets parent to itself
    }
    this.parent = parent;
    this.mount = parent.mount;
    this.mounted = null;
    this.id = FS.nextInode++;
    this.name = name;
    this.mode = mode;
    this.node_ops = {};
    this.stream_ops = {};
    this.rdev = rdev;
  };
  var readMode = 292/*292*/ | 73/*73*/;
  var writeMode = 146/*146*/;
  Object.defineProperties(FSNode.prototype, {
   read: {
    get: /** @this{FSNode} */function() {
     return (this.mode & readMode) === readMode;
    },
    set: /** @this{FSNode} */function(val) {
     val ? this.mode |= readMode : this.mode &= ~readMode;
    }
   },
   write: {
    get: /** @this{FSNode} */function() {
     return (this.mode & writeMode) === writeMode;
    },
    set: /** @this{FSNode} */function(val) {
     val ? this.mode |= writeMode : this.mode &= ~writeMode;
    }
   },
   isFolder: {
    get: /** @this{FSNode} */function() {
     return FS.isDir(this.mode);
    }
   },
   isDevice: {
    get: /** @this{FSNode} */function() {
     return FS.isChrdev(this.mode);
    }
   }
  });
  FS.FSNode = FSNode;
  FS.createPreloadedFile = FS_createPreloadedFile;
  FS.staticInit();;
embind_init_charCodes();
BindingError = Module['BindingError'] = class BindingError extends Error { constructor(message) { super(message); this.name = 'BindingError'; }};
InternalError = Module['InternalError'] = class InternalError extends Error { constructor(message) { super(message); this.name = 'InternalError'; }};
handleAllocatorInit();
init_emval();;
var GLctx;;
for (var i = 0; i < 32; ++i) tempFixedLengthArray.push(new Array(i));;
function checkIncomingModuleAPI() {
  ignoredModuleProp('fetchSettings');
}
var wasmImports = {
  /** @export */
  __syscall_fcntl64: ___syscall_fcntl64,
  /** @export */
  __syscall_fstat64: ___syscall_fstat64,
  /** @export */
  __syscall_ioctl: ___syscall_ioctl,
  /** @export */
  __syscall_lstat64: ___syscall_lstat64,
  /** @export */
  __syscall_newfstatat: ___syscall_newfstatat,
  /** @export */
  __syscall_openat: ___syscall_openat,
  /** @export */
  __syscall_stat64: ___syscall_stat64,
  /** @export */
  _embind_register_bigint: __embind_register_bigint,
  /** @export */
  _embind_register_bool: __embind_register_bool,
  /** @export */
  _embind_register_emval: __embind_register_emval,
  /** @export */
  _embind_register_float: __embind_register_float,
  /** @export */
  _embind_register_integer: __embind_register_integer,
  /** @export */
  _embind_register_memory_view: __embind_register_memory_view,
  /** @export */
  _embind_register_std_string: __embind_register_std_string,
  /** @export */
  _embind_register_std_wstring: __embind_register_std_wstring,
  /** @export */
  _embind_register_void: __embind_register_void,
  /** @export */
  _emscripten_get_now_is_monotonic: __emscripten_get_now_is_monotonic,
  /** @export */
  _emscripten_throw_longjmp: __emscripten_throw_longjmp,
  /** @export */
  _mmap_js: __mmap_js,
  /** @export */
  _munmap_js: __munmap_js,
  /** @export */
  abort: _abort,
  /** @export */
  emscripten_asm_const_int: _emscripten_asm_const_int,
  /** @export */
  emscripten_date_now: _emscripten_date_now,
  /** @export */
  emscripten_get_now: _emscripten_get_now,
  /** @export */
  emscripten_memcpy_js: _emscripten_memcpy_js,
  /** @export */
  emscripten_resize_heap: _emscripten_resize_heap,
  /** @export */
  environ_get: _environ_get,
  /** @export */
  environ_sizes_get: _environ_sizes_get,
  /** @export */
  exit: _exit,
  /** @export */
  fd_close: _fd_close,
  /** @export */
  fd_pread: _fd_pread,
  /** @export */
  fd_read: _fd_read,
  /** @export */
  fd_seek: _fd_seek,
  /** @export */
  fd_write: _fd_write,
  /** @export */
  glActiveTexture: _glActiveTexture,
  /** @export */
  glAttachShader: _glAttachShader,
  /** @export */
  glBindAttribLocation: _glBindAttribLocation,
  /** @export */
  glBindBuffer: _glBindBuffer,
  /** @export */
  glBindFramebuffer: _glBindFramebuffer,
  /** @export */
  glBindRenderbuffer: _glBindRenderbuffer,
  /** @export */
  glBindSampler: _glBindSampler,
  /** @export */
  glBindTexture: _glBindTexture,
  /** @export */
  glBindVertexArray: _glBindVertexArray,
  /** @export */
  glBindVertexArrayOES: _glBindVertexArrayOES,
  /** @export */
  glBlendColor: _glBlendColor,
  /** @export */
  glBlendEquation: _glBlendEquation,
  /** @export */
  glBlendFunc: _glBlendFunc,
  /** @export */
  glBlitFramebuffer: _glBlitFramebuffer,
  /** @export */
  glBufferData: _glBufferData,
  /** @export */
  glBufferSubData: _glBufferSubData,
  /** @export */
  glCheckFramebufferStatus: _glCheckFramebufferStatus,
  /** @export */
  glClear: _glClear,
  /** @export */
  glClearColor: _glClearColor,
  /** @export */
  glClearStencil: _glClearStencil,
  /** @export */
  glClientWaitSync: _glClientWaitSync,
  /** @export */
  glColorMask: _glColorMask,
  /** @export */
  glCompileShader: _glCompileShader,
  /** @export */
  glCompressedTexImage2D: _glCompressedTexImage2D,
  /** @export */
  glCompressedTexSubImage2D: _glCompressedTexSubImage2D,
  /** @export */
  glCopyBufferSubData: _glCopyBufferSubData,
  /** @export */
  glCopyTexSubImage2D: _glCopyTexSubImage2D,
  /** @export */
  glCreateProgram: _glCreateProgram,
  /** @export */
  glCreateShader: _glCreateShader,
  /** @export */
  glCullFace: _glCullFace,
  /** @export */
  glDeleteBuffers: _glDeleteBuffers,
  /** @export */
  glDeleteFramebuffers: _glDeleteFramebuffers,
  /** @export */
  glDeleteProgram: _glDeleteProgram,
  /** @export */
  glDeleteRenderbuffers: _glDeleteRenderbuffers,
  /** @export */
  glDeleteSamplers: _glDeleteSamplers,
  /** @export */
  glDeleteShader: _glDeleteShader,
  /** @export */
  glDeleteSync: _glDeleteSync,
  /** @export */
  glDeleteTextures: _glDeleteTextures,
  /** @export */
  glDeleteVertexArrays: _glDeleteVertexArrays,
  /** @export */
  glDeleteVertexArraysOES: _glDeleteVertexArraysOES,
  /** @export */
  glDepthMask: _glDepthMask,
  /** @export */
  glDisable: _glDisable,
  /** @export */
  glDisableVertexAttribArray: _glDisableVertexAttribArray,
  /** @export */
  glDrawArrays: _glDrawArrays,
  /** @export */
  glDrawArraysInstanced: _glDrawArraysInstanced,
  /** @export */
  glDrawArraysInstancedBaseInstanceWEBGL: _glDrawArraysInstancedBaseInstanceWEBGL,
  /** @export */
  glDrawBuffers: _glDrawBuffers,
  /** @export */
  glDrawElements: _glDrawElements,
  /** @export */
  glDrawElementsInstanced: _glDrawElementsInstanced,
  /** @export */
  glDrawElementsInstancedBaseVertexBaseInstanceWEBGL: _glDrawElementsInstancedBaseVertexBaseInstanceWEBGL,
  /** @export */
  glDrawRangeElements: _glDrawRangeElements,
  /** @export */
  glEnable: _glEnable,
  /** @export */
  glEnableVertexAttribArray: _glEnableVertexAttribArray,
  /** @export */
  glFenceSync: _glFenceSync,
  /** @export */
  glFinish: _glFinish,
  /** @export */
  glFlush: _glFlush,
  /** @export */
  glFramebufferRenderbuffer: _glFramebufferRenderbuffer,
  /** @export */
  glFramebufferTexture2D: _glFramebufferTexture2D,
  /** @export */
  glFrontFace: _glFrontFace,
  /** @export */
  glGenBuffers: _glGenBuffers,
  /** @export */
  glGenFramebuffers: _glGenFramebuffers,
  /** @export */
  glGenRenderbuffers: _glGenRenderbuffers,
  /** @export */
  glGenSamplers: _glGenSamplers,
  /** @export */
  glGenTextures: _glGenTextures,
  /** @export */
  glGenVertexArrays: _glGenVertexArrays,
  /** @export */
  glGenVertexArraysOES: _glGenVertexArraysOES,
  /** @export */
  glGenerateMipmap: _glGenerateMipmap,
  /** @export */
  glGetBufferParameteriv: _glGetBufferParameteriv,
  /** @export */
  glGetError: _glGetError,
  /** @export */
  glGetFloatv: _glGetFloatv,
  /** @export */
  glGetFramebufferAttachmentParameteriv: _glGetFramebufferAttachmentParameteriv,
  /** @export */
  glGetIntegerv: _glGetIntegerv,
  /** @export */
  glGetProgramInfoLog: _glGetProgramInfoLog,
  /** @export */
  glGetProgramiv: _glGetProgramiv,
  /** @export */
  glGetRenderbufferParameteriv: _glGetRenderbufferParameteriv,
  /** @export */
  glGetShaderInfoLog: _glGetShaderInfoLog,
  /** @export */
  glGetShaderPrecisionFormat: _glGetShaderPrecisionFormat,
  /** @export */
  glGetShaderiv: _glGetShaderiv,
  /** @export */
  glGetString: _glGetString,
  /** @export */
  glGetStringi: _glGetStringi,
  /** @export */
  glGetUniformLocation: _glGetUniformLocation,
  /** @export */
  glInvalidateFramebuffer: _glInvalidateFramebuffer,
  /** @export */
  glInvalidateSubFramebuffer: _glInvalidateSubFramebuffer,
  /** @export */
  glIsSync: _glIsSync,
  /** @export */
  glIsTexture: _glIsTexture,
  /** @export */
  glLineWidth: _glLineWidth,
  /** @export */
  glLinkProgram: _glLinkProgram,
  /** @export */
  glMultiDrawArraysInstancedBaseInstanceWEBGL: _glMultiDrawArraysInstancedBaseInstanceWEBGL,
  /** @export */
  glMultiDrawElementsInstancedBaseVertexBaseInstanceWEBGL: _glMultiDrawElementsInstancedBaseVertexBaseInstanceWEBGL,
  /** @export */
  glPixelStorei: _glPixelStorei,
  /** @export */
  glReadBuffer: _glReadBuffer,
  /** @export */
  glReadPixels: _glReadPixels,
  /** @export */
  glRenderbufferStorage: _glRenderbufferStorage,
  /** @export */
  glRenderbufferStorageMultisample: _glRenderbufferStorageMultisample,
  /** @export */
  glSamplerParameterf: _glSamplerParameterf,
  /** @export */
  glSamplerParameteri: _glSamplerParameteri,
  /** @export */
  glSamplerParameteriv: _glSamplerParameteriv,
  /** @export */
  glScissor: _glScissor,
  /** @export */
  glShaderSource: _glShaderSource,
  /** @export */
  glStencilFunc: _glStencilFunc,
  /** @export */
  glStencilFuncSeparate: _glStencilFuncSeparate,
  /** @export */
  glStencilMask: _glStencilMask,
  /** @export */
  glStencilMaskSeparate: _glStencilMaskSeparate,
  /** @export */
  glStencilOp: _glStencilOp,
  /** @export */
  glStencilOpSeparate: _glStencilOpSeparate,
  /** @export */
  glTexImage2D: _glTexImage2D,
  /** @export */
  glTexParameterf: _glTexParameterf,
  /** @export */
  glTexParameterfv: _glTexParameterfv,
  /** @export */
  glTexParameteri: _glTexParameteri,
  /** @export */
  glTexParameteriv: _glTexParameteriv,
  /** @export */
  glTexStorage2D: _glTexStorage2D,
  /** @export */
  glTexSubImage2D: _glTexSubImage2D,
  /** @export */
  glUniform1f: _glUniform1f,
  /** @export */
  glUniform1fv: _glUniform1fv,
  /** @export */
  glUniform1i: _glUniform1i,
  /** @export */
  glUniform1iv: _glUniform1iv,
  /** @export */
  glUniform2f: _glUniform2f,
  /** @export */
  glUniform2fv: _glUniform2fv,
  /** @export */
  glUniform2i: _glUniform2i,
  /** @export */
  glUniform2iv: _glUniform2iv,
  /** @export */
  glUniform3f: _glUniform3f,
  /** @export */
  glUniform3fv: _glUniform3fv,
  /** @export */
  glUniform3i: _glUniform3i,
  /** @export */
  glUniform3iv: _glUniform3iv,
  /** @export */
  glUniform4f: _glUniform4f,
  /** @export */
  glUniform4fv: _glUniform4fv,
  /** @export */
  glUniform4i: _glUniform4i,
  /** @export */
  glUniform4iv: _glUniform4iv,
  /** @export */
  glUniformMatrix2fv: _glUniformMatrix2fv,
  /** @export */
  glUniformMatrix3fv: _glUniformMatrix3fv,
  /** @export */
  glUniformMatrix4fv: _glUniformMatrix4fv,
  /** @export */
  glUseProgram: _glUseProgram,
  /** @export */
  glVertexAttrib1f: _glVertexAttrib1f,
  /** @export */
  glVertexAttrib2fv: _glVertexAttrib2fv,
  /** @export */
  glVertexAttrib3fv: _glVertexAttrib3fv,
  /** @export */
  glVertexAttrib4fv: _glVertexAttrib4fv,
  /** @export */
  glVertexAttribDivisor: _glVertexAttribDivisor,
  /** @export */
  glVertexAttribIPointer: _glVertexAttribIPointer,
  /** @export */
  glVertexAttribPointer: _glVertexAttribPointer,
  /** @export */
  glViewport: _glViewport,
  /** @export */
  glWaitSync: _glWaitSync,
  /** @export */
  invoke_ii: invoke_ii,
  /** @export */
  invoke_iii: invoke_iii,
  /** @export */
  invoke_iiii: invoke_iiii,
  /** @export */
  invoke_iiiii: invoke_iiiii,
  /** @export */
  invoke_iiiiii: invoke_iiiiii,
  /** @export */
  invoke_iiiiiii: invoke_iiiiiii,
  /** @export */
  invoke_iiiiiiiiii: invoke_iiiiiiiiii,
  /** @export */
  invoke_v: invoke_v,
  /** @export */
  invoke_vi: invoke_vi,
  /** @export */
  invoke_vii: invoke_vii,
  /** @export */
  invoke_viii: invoke_viii,
  /** @export */
  invoke_viiii: invoke_viiii,
  /** @export */
  invoke_viiiii: invoke_viiiii,
  /** @export */
  invoke_viiiiii: invoke_viiiiii,
  /** @export */
  invoke_viiiiiiiii: invoke_viiiiiiiii,
  /** @export */
  strftime_l: _strftime_l
};
var wasmExports = createWasm();
var ___wasm_call_ctors = createExportWrapper('__wasm_call_ctors');
var org_jetbrains_skia_svg_SVGCanvas__1nMake = Module['org_jetbrains_skia_svg_SVGCanvas__1nMake'] = createExportWrapper('org_jetbrains_skia_svg_SVGCanvas__1nMake');
var org_jetbrains_skia_svg_SVGSVG__1nGetTag = Module['org_jetbrains_skia_svg_SVGSVG__1nGetTag'] = createExportWrapper('org_jetbrains_skia_svg_SVGSVG__1nGetTag');
var org_jetbrains_skia_svg_SVGSVG__1nGetX = Module['org_jetbrains_skia_svg_SVGSVG__1nGetX'] = createExportWrapper('org_jetbrains_skia_svg_SVGSVG__1nGetX');
var org_jetbrains_skia_svg_SVGSVG__1nGetY = Module['org_jetbrains_skia_svg_SVGSVG__1nGetY'] = createExportWrapper('org_jetbrains_skia_svg_SVGSVG__1nGetY');
var org_jetbrains_skia_svg_SVGSVG__1nGetHeight = Module['org_jetbrains_skia_svg_SVGSVG__1nGetHeight'] = createExportWrapper('org_jetbrains_skia_svg_SVGSVG__1nGetHeight');
var org_jetbrains_skia_svg_SVGSVG__1nGetWidth = Module['org_jetbrains_skia_svg_SVGSVG__1nGetWidth'] = createExportWrapper('org_jetbrains_skia_svg_SVGSVG__1nGetWidth');
var org_jetbrains_skia_svg_SVGSVG__1nGetPreserveAspectRatio = Module['org_jetbrains_skia_svg_SVGSVG__1nGetPreserveAspectRatio'] = createExportWrapper('org_jetbrains_skia_svg_SVGSVG__1nGetPreserveAspectRatio');
var org_jetbrains_skia_svg_SVGSVG__1nGetViewBox = Module['org_jetbrains_skia_svg_SVGSVG__1nGetViewBox'] = createExportWrapper('org_jetbrains_skia_svg_SVGSVG__1nGetViewBox');
var org_jetbrains_skia_svg_SVGSVG__1nGetIntrinsicSize = Module['org_jetbrains_skia_svg_SVGSVG__1nGetIntrinsicSize'] = createExportWrapper('org_jetbrains_skia_svg_SVGSVG__1nGetIntrinsicSize');
var org_jetbrains_skia_svg_SVGSVG__1nSetX = Module['org_jetbrains_skia_svg_SVGSVG__1nSetX'] = createExportWrapper('org_jetbrains_skia_svg_SVGSVG__1nSetX');
var org_jetbrains_skia_svg_SVGSVG__1nSetY = Module['org_jetbrains_skia_svg_SVGSVG__1nSetY'] = createExportWrapper('org_jetbrains_skia_svg_SVGSVG__1nSetY');
var org_jetbrains_skia_svg_SVGSVG__1nSetWidth = Module['org_jetbrains_skia_svg_SVGSVG__1nSetWidth'] = createExportWrapper('org_jetbrains_skia_svg_SVGSVG__1nSetWidth');
var org_jetbrains_skia_svg_SVGSVG__1nSetHeight = Module['org_jetbrains_skia_svg_SVGSVG__1nSetHeight'] = createExportWrapper('org_jetbrains_skia_svg_SVGSVG__1nSetHeight');
var org_jetbrains_skia_svg_SVGSVG__1nSetPreserveAspectRatio = Module['org_jetbrains_skia_svg_SVGSVG__1nSetPreserveAspectRatio'] = createExportWrapper('org_jetbrains_skia_svg_SVGSVG__1nSetPreserveAspectRatio');
var org_jetbrains_skia_svg_SVGSVG__1nSetViewBox = Module['org_jetbrains_skia_svg_SVGSVG__1nSetViewBox'] = createExportWrapper('org_jetbrains_skia_svg_SVGSVG__1nSetViewBox');
var org_jetbrains_skia_svg_SVGDOM__1nMakeFromData = Module['org_jetbrains_skia_svg_SVGDOM__1nMakeFromData'] = createExportWrapper('org_jetbrains_skia_svg_SVGDOM__1nMakeFromData');
var org_jetbrains_skia_svg_SVGDOM__1nGetRoot = Module['org_jetbrains_skia_svg_SVGDOM__1nGetRoot'] = createExportWrapper('org_jetbrains_skia_svg_SVGDOM__1nGetRoot');
var org_jetbrains_skia_svg_SVGDOM__1nGetContainerSize = Module['org_jetbrains_skia_svg_SVGDOM__1nGetContainerSize'] = createExportWrapper('org_jetbrains_skia_svg_SVGDOM__1nGetContainerSize');
var org_jetbrains_skia_svg_SVGDOM__1nSetContainerSize = Module['org_jetbrains_skia_svg_SVGDOM__1nSetContainerSize'] = createExportWrapper('org_jetbrains_skia_svg_SVGDOM__1nSetContainerSize');
var org_jetbrains_skia_svg_SVGDOM__1nRender = Module['org_jetbrains_skia_svg_SVGDOM__1nRender'] = createExportWrapper('org_jetbrains_skia_svg_SVGDOM__1nRender');
var org_jetbrains_skia_svg_SVGNode__1nGetTag = Module['org_jetbrains_skia_svg_SVGNode__1nGetTag'] = createExportWrapper('org_jetbrains_skia_svg_SVGNode__1nGetTag');
var org_jetbrains_skiko_tests_TestHelpers__1nFillByteArrayOf5 = Module['org_jetbrains_skiko_tests_TestHelpers__1nFillByteArrayOf5'] = createExportWrapper('org_jetbrains_skiko_tests_TestHelpers__1nFillByteArrayOf5');
var org_jetbrains_skiko_tests_TestHelpers__1nFillFloatArrayOf5 = Module['org_jetbrains_skiko_tests_TestHelpers__1nFillFloatArrayOf5'] = createExportWrapper('org_jetbrains_skiko_tests_TestHelpers__1nFillFloatArrayOf5');
var org_jetbrains_skiko_tests_TestHelpers__1nFillShortArrayOf5 = Module['org_jetbrains_skiko_tests_TestHelpers__1nFillShortArrayOf5'] = createExportWrapper('org_jetbrains_skiko_tests_TestHelpers__1nFillShortArrayOf5');
var org_jetbrains_skiko_tests_TestHelpers__1nFillIntArrayOf5 = Module['org_jetbrains_skiko_tests_TestHelpers__1nFillIntArrayOf5'] = createExportWrapper('org_jetbrains_skiko_tests_TestHelpers__1nFillIntArrayOf5');
var org_jetbrains_skiko_tests_TestHelpers__1nFillDoubleArrayOf5 = Module['org_jetbrains_skiko_tests_TestHelpers__1nFillDoubleArrayOf5'] = createExportWrapper('org_jetbrains_skiko_tests_TestHelpers__1nFillDoubleArrayOf5');
var org_jetbrains_skiko_tests_TestHelpers__nStringByIndex = Module['org_jetbrains_skiko_tests_TestHelpers__nStringByIndex'] = createExportWrapper('org_jetbrains_skiko_tests_TestHelpers__nStringByIndex');
var org_jetbrains_skiko_tests_TestHelpers__1nWriteArraysOfInts = Module['org_jetbrains_skiko_tests_TestHelpers__1nWriteArraysOfInts'] = createExportWrapper('org_jetbrains_skiko_tests_TestHelpers__1nWriteArraysOfInts');
var _malloc = createExportWrapper('malloc');
var org_jetbrains_skiko_tests_TestHelpers__1nGlContextGetFinalizer = Module['org_jetbrains_skiko_tests_TestHelpers__1nGlContextGetFinalizer'] = createExportWrapper('org_jetbrains_skiko_tests_TestHelpers__1nGlContextGetFinalizer');
var org_jetbrains_skiko_tests_TestHelpers__1nDeleteTestGlContext = Module['org_jetbrains_skiko_tests_TestHelpers__1nDeleteTestGlContext'] = createExportWrapper('org_jetbrains_skiko_tests_TestHelpers__1nDeleteTestGlContext');
var org_jetbrains_skiko_tests_TestHelpers__1nCreateTestGlContext = Module['org_jetbrains_skiko_tests_TestHelpers__1nCreateTestGlContext'] = createExportWrapper('org_jetbrains_skiko_tests_TestHelpers__1nCreateTestGlContext');
var org_jetbrains_skiko_tests_TestHelpers__1nMakeGlContextCurrent = Module['org_jetbrains_skiko_tests_TestHelpers__1nMakeGlContextCurrent'] = createExportWrapper('org_jetbrains_skiko_tests_TestHelpers__1nMakeGlContextCurrent');
var org_jetbrains_skiko_tests_TestHelpers__1nGlContextSwapBuffers = Module['org_jetbrains_skiko_tests_TestHelpers__1nGlContextSwapBuffers'] = createExportWrapper('org_jetbrains_skiko_tests_TestHelpers__1nGlContextSwapBuffers');
var org_jetbrains_skia_StdVectorDecoder__1nGetArraySize = Module['org_jetbrains_skia_StdVectorDecoder__1nGetArraySize'] = createExportWrapper('org_jetbrains_skia_StdVectorDecoder__1nGetArraySize');
var org_jetbrains_skia_StdVectorDecoder__1nReleaseElement = Module['org_jetbrains_skia_StdVectorDecoder__1nReleaseElement'] = createExportWrapper('org_jetbrains_skia_StdVectorDecoder__1nReleaseElement');
var org_jetbrains_skia_StdVectorDecoder__1nDisposeArray = Module['org_jetbrains_skia_StdVectorDecoder__1nDisposeArray'] = createExportWrapper('org_jetbrains_skia_StdVectorDecoder__1nDisposeArray');
var org_jetbrains_skia_FontMgr__1nGetFamiliesCount = Module['org_jetbrains_skia_FontMgr__1nGetFamiliesCount'] = createExportWrapper('org_jetbrains_skia_FontMgr__1nGetFamiliesCount');
var org_jetbrains_skia_FontMgr__1nGetFamilyName = Module['org_jetbrains_skia_FontMgr__1nGetFamilyName'] = createExportWrapper('org_jetbrains_skia_FontMgr__1nGetFamilyName');
var org_jetbrains_skia_FontMgr__1nMakeStyleSet = Module['org_jetbrains_skia_FontMgr__1nMakeStyleSet'] = createExportWrapper('org_jetbrains_skia_FontMgr__1nMakeStyleSet');
var org_jetbrains_skia_FontMgr__1nMatchFamily = Module['org_jetbrains_skia_FontMgr__1nMatchFamily'] = createExportWrapper('org_jetbrains_skia_FontMgr__1nMatchFamily');
var org_jetbrains_skia_FontMgr__1nMatchFamilyStyle = Module['org_jetbrains_skia_FontMgr__1nMatchFamilyStyle'] = createExportWrapper('org_jetbrains_skia_FontMgr__1nMatchFamilyStyle');
var org_jetbrains_skia_FontMgr__1nMatchFamilyStyleCharacter = Module['org_jetbrains_skia_FontMgr__1nMatchFamilyStyleCharacter'] = createExportWrapper('org_jetbrains_skia_FontMgr__1nMatchFamilyStyleCharacter');
var org_jetbrains_skia_FontMgr__1nMakeFromData = Module['org_jetbrains_skia_FontMgr__1nMakeFromData'] = createExportWrapper('org_jetbrains_skia_FontMgr__1nMakeFromData');
var org_jetbrains_skia_FontMgr__1nMakeFromFile = Module['org_jetbrains_skia_FontMgr__1nMakeFromFile'] = createExportWrapper('org_jetbrains_skia_FontMgr__1nMakeFromFile');
var org_jetbrains_skia_FontMgr__1nLegacyMakeTypeface = Module['org_jetbrains_skia_FontMgr__1nLegacyMakeTypeface'] = createExportWrapper('org_jetbrains_skia_FontMgr__1nLegacyMakeTypeface');
var org_jetbrains_skia_FontMgr__1nDefault = Module['org_jetbrains_skia_FontMgr__1nDefault'] = createExportWrapper('org_jetbrains_skia_FontMgr__1nDefault');
var org_jetbrains_skia_FontMgr__1nEmpty = Module['org_jetbrains_skia_FontMgr__1nEmpty'] = createExportWrapper('org_jetbrains_skia_FontMgr__1nEmpty');
var org_jetbrains_skia_FontMgrWithFallback__1nDefaultWithFallbackFontProvider = Module['org_jetbrains_skia_FontMgrWithFallback__1nDefaultWithFallbackFontProvider'] = createExportWrapper('org_jetbrains_skia_FontMgrWithFallback__1nDefaultWithFallbackFontProvider');
var org_jetbrains_skia_PathUtils__1nFillPathWithPaint = Module['org_jetbrains_skia_PathUtils__1nFillPathWithPaint'] = createExportWrapper('org_jetbrains_skia_PathUtils__1nFillPathWithPaint');
var org_jetbrains_skia_PathUtils__1nFillPathWithPaintCull = Module['org_jetbrains_skia_PathUtils__1nFillPathWithPaintCull'] = createExportWrapper('org_jetbrains_skia_PathUtils__1nFillPathWithPaintCull');
var org_jetbrains_skia_ShadowUtils__1nDrawShadow = Module['org_jetbrains_skia_ShadowUtils__1nDrawShadow'] = createExportWrapper('org_jetbrains_skia_ShadowUtils__1nDrawShadow');
var org_jetbrains_skia_ShadowUtils__1nComputeTonalAmbientColor = Module['org_jetbrains_skia_ShadowUtils__1nComputeTonalAmbientColor'] = createExportWrapper('org_jetbrains_skia_ShadowUtils__1nComputeTonalAmbientColor');
var org_jetbrains_skia_ShadowUtils__1nComputeTonalSpotColor = Module['org_jetbrains_skia_ShadowUtils__1nComputeTonalSpotColor'] = createExportWrapper('org_jetbrains_skia_ShadowUtils__1nComputeTonalSpotColor');
var org_jetbrains_skia_Picture__1nMakeFromData = Module['org_jetbrains_skia_Picture__1nMakeFromData'] = createExportWrapper('org_jetbrains_skia_Picture__1nMakeFromData');
var org_jetbrains_skia_Picture__1nPlayback = Module['org_jetbrains_skia_Picture__1nPlayback'] = createExportWrapper('org_jetbrains_skia_Picture__1nPlayback');
var org_jetbrains_skia_Picture__1nGetCullRect = Module['org_jetbrains_skia_Picture__1nGetCullRect'] = createExportWrapper('org_jetbrains_skia_Picture__1nGetCullRect');
var org_jetbrains_skia_Picture__1nGetUniqueId = Module['org_jetbrains_skia_Picture__1nGetUniqueId'] = createExportWrapper('org_jetbrains_skia_Picture__1nGetUniqueId');
var org_jetbrains_skia_Picture__1nSerializeToData = Module['org_jetbrains_skia_Picture__1nSerializeToData'] = createExportWrapper('org_jetbrains_skia_Picture__1nSerializeToData');
var org_jetbrains_skia_Picture__1nMakePlaceholder = Module['org_jetbrains_skia_Picture__1nMakePlaceholder'] = createExportWrapper('org_jetbrains_skia_Picture__1nMakePlaceholder');
var org_jetbrains_skia_Picture__1nGetApproximateOpCount = Module['org_jetbrains_skia_Picture__1nGetApproximateOpCount'] = createExportWrapper('org_jetbrains_skia_Picture__1nGetApproximateOpCount');
var org_jetbrains_skia_Picture__1nGetApproximateBytesUsed = Module['org_jetbrains_skia_Picture__1nGetApproximateBytesUsed'] = createExportWrapper('org_jetbrains_skia_Picture__1nGetApproximateBytesUsed');
var org_jetbrains_skia_Picture__1nMakeShader = Module['org_jetbrains_skia_Picture__1nMakeShader'] = createExportWrapper('org_jetbrains_skia_Picture__1nMakeShader');
var org_jetbrains_skia_PathSegmentIterator__1nMake = Module['org_jetbrains_skia_PathSegmentIterator__1nMake'] = createExportWrapper('org_jetbrains_skia_PathSegmentIterator__1nMake');
var org_jetbrains_skia_PathSegmentIterator__1nGetFinalizer = Module['org_jetbrains_skia_PathSegmentIterator__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_PathSegmentIterator__1nGetFinalizer');
var org_jetbrains_skia_PathSegmentIterator__1nNext = Module['org_jetbrains_skia_PathSegmentIterator__1nNext'] = createExportWrapper('org_jetbrains_skia_PathSegmentIterator__1nNext');
var org_jetbrains_skia_ColorFilter__1nMakeComposed = Module['org_jetbrains_skia_ColorFilter__1nMakeComposed'] = createExportWrapper('org_jetbrains_skia_ColorFilter__1nMakeComposed');
var org_jetbrains_skia_ColorFilter__1nMakeBlend = Module['org_jetbrains_skia_ColorFilter__1nMakeBlend'] = createExportWrapper('org_jetbrains_skia_ColorFilter__1nMakeBlend');
var org_jetbrains_skia_ColorFilter__1nMakeMatrix = Module['org_jetbrains_skia_ColorFilter__1nMakeMatrix'] = createExportWrapper('org_jetbrains_skia_ColorFilter__1nMakeMatrix');
var org_jetbrains_skia_ColorFilter__1nMakeHSLAMatrix = Module['org_jetbrains_skia_ColorFilter__1nMakeHSLAMatrix'] = createExportWrapper('org_jetbrains_skia_ColorFilter__1nMakeHSLAMatrix');
var org_jetbrains_skia_ColorFilter__1nGetLinearToSRGBGamma = Module['org_jetbrains_skia_ColorFilter__1nGetLinearToSRGBGamma'] = createExportWrapper('org_jetbrains_skia_ColorFilter__1nGetLinearToSRGBGamma');
var org_jetbrains_skia_ColorFilter__1nGetSRGBToLinearGamma = Module['org_jetbrains_skia_ColorFilter__1nGetSRGBToLinearGamma'] = createExportWrapper('org_jetbrains_skia_ColorFilter__1nGetSRGBToLinearGamma');
var org_jetbrains_skia_ColorFilter__1nMakeLerp = Module['org_jetbrains_skia_ColorFilter__1nMakeLerp'] = createExportWrapper('org_jetbrains_skia_ColorFilter__1nMakeLerp');
var org_jetbrains_skia_ColorFilter__1nMakeLighting = Module['org_jetbrains_skia_ColorFilter__1nMakeLighting'] = createExportWrapper('org_jetbrains_skia_ColorFilter__1nMakeLighting');
var org_jetbrains_skia_ColorFilter__1nMakeHighContrast = Module['org_jetbrains_skia_ColorFilter__1nMakeHighContrast'] = createExportWrapper('org_jetbrains_skia_ColorFilter__1nMakeHighContrast');
var org_jetbrains_skia_ColorFilter__1nMakeTable = Module['org_jetbrains_skia_ColorFilter__1nMakeTable'] = createExportWrapper('org_jetbrains_skia_ColorFilter__1nMakeTable');
var org_jetbrains_skia_ColorFilter__1nMakeTableARGB = Module['org_jetbrains_skia_ColorFilter__1nMakeTableARGB'] = createExportWrapper('org_jetbrains_skia_ColorFilter__1nMakeTableARGB');
var org_jetbrains_skia_ColorFilter__1nMakeOverdraw = Module['org_jetbrains_skia_ColorFilter__1nMakeOverdraw'] = createExportWrapper('org_jetbrains_skia_ColorFilter__1nMakeOverdraw');
var org_jetbrains_skia_ColorFilter__1nGetLuma = Module['org_jetbrains_skia_ColorFilter__1nGetLuma'] = createExportWrapper('org_jetbrains_skia_ColorFilter__1nGetLuma');
var org_jetbrains_skia_BreakIterator__1nGetFinalizer = Module['org_jetbrains_skia_BreakIterator__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_BreakIterator__1nGetFinalizer');
var org_jetbrains_skia_BreakIterator__1nMake = Module['org_jetbrains_skia_BreakIterator__1nMake'] = createExportWrapper('org_jetbrains_skia_BreakIterator__1nMake');
var org_jetbrains_skia_BreakIterator__1nClone = Module['org_jetbrains_skia_BreakIterator__1nClone'] = createExportWrapper('org_jetbrains_skia_BreakIterator__1nClone');
var org_jetbrains_skia_BreakIterator__1nCurrent = Module['org_jetbrains_skia_BreakIterator__1nCurrent'] = createExportWrapper('org_jetbrains_skia_BreakIterator__1nCurrent');
var org_jetbrains_skia_BreakIterator__1nNext = Module['org_jetbrains_skia_BreakIterator__1nNext'] = createExportWrapper('org_jetbrains_skia_BreakIterator__1nNext');
var org_jetbrains_skia_BreakIterator__1nPrevious = Module['org_jetbrains_skia_BreakIterator__1nPrevious'] = createExportWrapper('org_jetbrains_skia_BreakIterator__1nPrevious');
var org_jetbrains_skia_BreakIterator__1nFirst = Module['org_jetbrains_skia_BreakIterator__1nFirst'] = createExportWrapper('org_jetbrains_skia_BreakIterator__1nFirst');
var org_jetbrains_skia_BreakIterator__1nLast = Module['org_jetbrains_skia_BreakIterator__1nLast'] = createExportWrapper('org_jetbrains_skia_BreakIterator__1nLast');
var org_jetbrains_skia_BreakIterator__1nPreceding = Module['org_jetbrains_skia_BreakIterator__1nPreceding'] = createExportWrapper('org_jetbrains_skia_BreakIterator__1nPreceding');
var org_jetbrains_skia_BreakIterator__1nFollowing = Module['org_jetbrains_skia_BreakIterator__1nFollowing'] = createExportWrapper('org_jetbrains_skia_BreakIterator__1nFollowing');
var org_jetbrains_skia_BreakIterator__1nIsBoundary = Module['org_jetbrains_skia_BreakIterator__1nIsBoundary'] = createExportWrapper('org_jetbrains_skia_BreakIterator__1nIsBoundary');
var org_jetbrains_skia_BreakIterator__1nGetRuleStatus = Module['org_jetbrains_skia_BreakIterator__1nGetRuleStatus'] = createExportWrapper('org_jetbrains_skia_BreakIterator__1nGetRuleStatus');
var org_jetbrains_skia_BreakIterator__1nGetRuleStatusesLen = Module['org_jetbrains_skia_BreakIterator__1nGetRuleStatusesLen'] = createExportWrapper('org_jetbrains_skia_BreakIterator__1nGetRuleStatusesLen');
var org_jetbrains_skia_BreakIterator__1nGetRuleStatuses = Module['org_jetbrains_skia_BreakIterator__1nGetRuleStatuses'] = createExportWrapper('org_jetbrains_skia_BreakIterator__1nGetRuleStatuses');
var org_jetbrains_skia_BreakIterator__1nSetText = Module['org_jetbrains_skia_BreakIterator__1nSetText'] = createExportWrapper('org_jetbrains_skia_BreakIterator__1nSetText');
var org_jetbrains_skia_Shader__1nMakeWithColorFilter = Module['org_jetbrains_skia_Shader__1nMakeWithColorFilter'] = createExportWrapper('org_jetbrains_skia_Shader__1nMakeWithColorFilter');
var org_jetbrains_skia_Shader__1nMakeLinearGradient = Module['org_jetbrains_skia_Shader__1nMakeLinearGradient'] = createExportWrapper('org_jetbrains_skia_Shader__1nMakeLinearGradient');
var org_jetbrains_skia_Shader__1nMakeLinearGradientCS = Module['org_jetbrains_skia_Shader__1nMakeLinearGradientCS'] = createExportWrapper('org_jetbrains_skia_Shader__1nMakeLinearGradientCS');
var org_jetbrains_skia_Shader__1nMakeRadialGradient = Module['org_jetbrains_skia_Shader__1nMakeRadialGradient'] = createExportWrapper('org_jetbrains_skia_Shader__1nMakeRadialGradient');
var org_jetbrains_skia_Shader__1nMakeRadialGradientCS = Module['org_jetbrains_skia_Shader__1nMakeRadialGradientCS'] = createExportWrapper('org_jetbrains_skia_Shader__1nMakeRadialGradientCS');
var org_jetbrains_skia_Shader__1nMakeTwoPointConicalGradient = Module['org_jetbrains_skia_Shader__1nMakeTwoPointConicalGradient'] = createExportWrapper('org_jetbrains_skia_Shader__1nMakeTwoPointConicalGradient');
var org_jetbrains_skia_Shader__1nMakeTwoPointConicalGradientCS = Module['org_jetbrains_skia_Shader__1nMakeTwoPointConicalGradientCS'] = createExportWrapper('org_jetbrains_skia_Shader__1nMakeTwoPointConicalGradientCS');
var org_jetbrains_skia_Shader__1nMakeSweepGradient = Module['org_jetbrains_skia_Shader__1nMakeSweepGradient'] = createExportWrapper('org_jetbrains_skia_Shader__1nMakeSweepGradient');
var org_jetbrains_skia_Shader__1nMakeSweepGradientCS = Module['org_jetbrains_skia_Shader__1nMakeSweepGradientCS'] = createExportWrapper('org_jetbrains_skia_Shader__1nMakeSweepGradientCS');
var org_jetbrains_skia_Shader__1nMakeEmpty = Module['org_jetbrains_skia_Shader__1nMakeEmpty'] = createExportWrapper('org_jetbrains_skia_Shader__1nMakeEmpty');
var org_jetbrains_skia_Shader__1nMakeColor = Module['org_jetbrains_skia_Shader__1nMakeColor'] = createExportWrapper('org_jetbrains_skia_Shader__1nMakeColor');
var org_jetbrains_skia_Shader__1nMakeColorCS = Module['org_jetbrains_skia_Shader__1nMakeColorCS'] = createExportWrapper('org_jetbrains_skia_Shader__1nMakeColorCS');
var org_jetbrains_skia_Shader__1nMakeBlend = Module['org_jetbrains_skia_Shader__1nMakeBlend'] = createExportWrapper('org_jetbrains_skia_Shader__1nMakeBlend');
var org_jetbrains_skia_Shader__1nMakeFractalNoise = Module['org_jetbrains_skia_Shader__1nMakeFractalNoise'] = createExportWrapper('org_jetbrains_skia_Shader__1nMakeFractalNoise');
var org_jetbrains_skia_Shader__1nMakeTurbulence = Module['org_jetbrains_skia_Shader__1nMakeTurbulence'] = createExportWrapper('org_jetbrains_skia_Shader__1nMakeTurbulence');
var org_jetbrains_skia_ManagedString__1nGetFinalizer = Module['org_jetbrains_skia_ManagedString__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_ManagedString__1nGetFinalizer');
var org_jetbrains_skia_ManagedString__1nMake = Module['org_jetbrains_skia_ManagedString__1nMake'] = createExportWrapper('org_jetbrains_skia_ManagedString__1nMake');
var org_jetbrains_skia_ManagedString__nStringSize = Module['org_jetbrains_skia_ManagedString__nStringSize'] = createExportWrapper('org_jetbrains_skia_ManagedString__nStringSize');
var org_jetbrains_skia_ManagedString__nStringData = Module['org_jetbrains_skia_ManagedString__nStringData'] = createExportWrapper('org_jetbrains_skia_ManagedString__nStringData');
var org_jetbrains_skia_ManagedString__1nInsert = Module['org_jetbrains_skia_ManagedString__1nInsert'] = createExportWrapper('org_jetbrains_skia_ManagedString__1nInsert');
var org_jetbrains_skia_ManagedString__1nAppend = Module['org_jetbrains_skia_ManagedString__1nAppend'] = createExportWrapper('org_jetbrains_skia_ManagedString__1nAppend');
var org_jetbrains_skia_ManagedString__1nRemoveSuffix = Module['org_jetbrains_skia_ManagedString__1nRemoveSuffix'] = createExportWrapper('org_jetbrains_skia_ManagedString__1nRemoveSuffix');
var org_jetbrains_skia_ManagedString__1nRemove = Module['org_jetbrains_skia_ManagedString__1nRemove'] = createExportWrapper('org_jetbrains_skia_ManagedString__1nRemove');
var org_jetbrains_skia_Drawable__1nGetFinalizer = Module['org_jetbrains_skia_Drawable__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_Drawable__1nGetFinalizer');
var org_jetbrains_skia_Drawable__1nSetBounds = Module['org_jetbrains_skia_Drawable__1nSetBounds'] = createExportWrapper('org_jetbrains_skia_Drawable__1nSetBounds');
var org_jetbrains_skia_Drawable__1nGetBounds = Module['org_jetbrains_skia_Drawable__1nGetBounds'] = createExportWrapper('org_jetbrains_skia_Drawable__1nGetBounds');
var org_jetbrains_skia_Drawable__1nGetOnDrawCanvas = Module['org_jetbrains_skia_Drawable__1nGetOnDrawCanvas'] = createExportWrapper('org_jetbrains_skia_Drawable__1nGetOnDrawCanvas');
var org_jetbrains_skia_Drawable__1nMake = Module['org_jetbrains_skia_Drawable__1nMake'] = createExportWrapper('org_jetbrains_skia_Drawable__1nMake');
var org_jetbrains_skia_Drawable__1nInit = Module['org_jetbrains_skia_Drawable__1nInit'] = createExportWrapper('org_jetbrains_skia_Drawable__1nInit');
var org_jetbrains_skia_Drawable__1nDraw = Module['org_jetbrains_skia_Drawable__1nDraw'] = createExportWrapper('org_jetbrains_skia_Drawable__1nDraw');
var org_jetbrains_skia_Drawable__1nMakePictureSnapshot = Module['org_jetbrains_skia_Drawable__1nMakePictureSnapshot'] = createExportWrapper('org_jetbrains_skia_Drawable__1nMakePictureSnapshot');
var org_jetbrains_skia_Drawable__1nGetGenerationId = Module['org_jetbrains_skia_Drawable__1nGetGenerationId'] = createExportWrapper('org_jetbrains_skia_Drawable__1nGetGenerationId');
var org_jetbrains_skia_Drawable__1nNotifyDrawingChanged = Module['org_jetbrains_skia_Drawable__1nNotifyDrawingChanged'] = createExportWrapper('org_jetbrains_skia_Drawable__1nNotifyDrawingChanged');
var org_jetbrains_skia_Surface__1nMakeRasterDirect = Module['org_jetbrains_skia_Surface__1nMakeRasterDirect'] = createExportWrapper('org_jetbrains_skia_Surface__1nMakeRasterDirect');
var org_jetbrains_skia_Surface__1nMakeRasterDirectWithPixmap = Module['org_jetbrains_skia_Surface__1nMakeRasterDirectWithPixmap'] = createExportWrapper('org_jetbrains_skia_Surface__1nMakeRasterDirectWithPixmap');
var org_jetbrains_skia_Surface__1nMakeRaster = Module['org_jetbrains_skia_Surface__1nMakeRaster'] = createExportWrapper('org_jetbrains_skia_Surface__1nMakeRaster');
var org_jetbrains_skia_Surface__1nMakeRasterN32Premul = Module['org_jetbrains_skia_Surface__1nMakeRasterN32Premul'] = createExportWrapper('org_jetbrains_skia_Surface__1nMakeRasterN32Premul');
var org_jetbrains_skia_Surface__1nMakeFromBackendRenderTarget = Module['org_jetbrains_skia_Surface__1nMakeFromBackendRenderTarget'] = createExportWrapper('org_jetbrains_skia_Surface__1nMakeFromBackendRenderTarget');
var org_jetbrains_skia_Surface__1nMakeFromMTKView = Module['org_jetbrains_skia_Surface__1nMakeFromMTKView'] = createExportWrapper('org_jetbrains_skia_Surface__1nMakeFromMTKView');
var org_jetbrains_skia_Surface__1nMakeRenderTarget = Module['org_jetbrains_skia_Surface__1nMakeRenderTarget'] = createExportWrapper('org_jetbrains_skia_Surface__1nMakeRenderTarget');
var org_jetbrains_skia_Surface__1nMakeNull = Module['org_jetbrains_skia_Surface__1nMakeNull'] = createExportWrapper('org_jetbrains_skia_Surface__1nMakeNull');
var org_jetbrains_skia_Surface__1nGetCanvas = Module['org_jetbrains_skia_Surface__1nGetCanvas'] = createExportWrapper('org_jetbrains_skia_Surface__1nGetCanvas');
var org_jetbrains_skia_Surface__1nGetWidth = Module['org_jetbrains_skia_Surface__1nGetWidth'] = createExportWrapper('org_jetbrains_skia_Surface__1nGetWidth');
var org_jetbrains_skia_Surface__1nGetHeight = Module['org_jetbrains_skia_Surface__1nGetHeight'] = createExportWrapper('org_jetbrains_skia_Surface__1nGetHeight');
var org_jetbrains_skia_Surface__1nMakeImageSnapshot = Module['org_jetbrains_skia_Surface__1nMakeImageSnapshot'] = createExportWrapper('org_jetbrains_skia_Surface__1nMakeImageSnapshot');
var org_jetbrains_skia_Surface__1nMakeImageSnapshotR = Module['org_jetbrains_skia_Surface__1nMakeImageSnapshotR'] = createExportWrapper('org_jetbrains_skia_Surface__1nMakeImageSnapshotR');
var org_jetbrains_skia_Surface__1nGenerationId = Module['org_jetbrains_skia_Surface__1nGenerationId'] = createExportWrapper('org_jetbrains_skia_Surface__1nGenerationId');
var org_jetbrains_skia_Surface__1nReadPixelsToPixmap = Module['org_jetbrains_skia_Surface__1nReadPixelsToPixmap'] = createExportWrapper('org_jetbrains_skia_Surface__1nReadPixelsToPixmap');
var org_jetbrains_skia_Surface__1nReadPixels = Module['org_jetbrains_skia_Surface__1nReadPixels'] = createExportWrapper('org_jetbrains_skia_Surface__1nReadPixels');
var org_jetbrains_skia_Surface__1nWritePixelsFromPixmap = Module['org_jetbrains_skia_Surface__1nWritePixelsFromPixmap'] = createExportWrapper('org_jetbrains_skia_Surface__1nWritePixelsFromPixmap');
var org_jetbrains_skia_Surface__1nWritePixels = Module['org_jetbrains_skia_Surface__1nWritePixels'] = createExportWrapper('org_jetbrains_skia_Surface__1nWritePixels');
var org_jetbrains_skia_Surface__1nUnique = Module['org_jetbrains_skia_Surface__1nUnique'] = createExportWrapper('org_jetbrains_skia_Surface__1nUnique');
var org_jetbrains_skia_Surface__1nGetImageInfo = Module['org_jetbrains_skia_Surface__1nGetImageInfo'] = createExportWrapper('org_jetbrains_skia_Surface__1nGetImageInfo');
var org_jetbrains_skia_Surface__1nMakeSurface = Module['org_jetbrains_skia_Surface__1nMakeSurface'] = createExportWrapper('org_jetbrains_skia_Surface__1nMakeSurface');
var org_jetbrains_skia_Surface__1nMakeSurfaceI = Module['org_jetbrains_skia_Surface__1nMakeSurfaceI'] = createExportWrapper('org_jetbrains_skia_Surface__1nMakeSurfaceI');
var org_jetbrains_skia_Surface__1nDraw = Module['org_jetbrains_skia_Surface__1nDraw'] = createExportWrapper('org_jetbrains_skia_Surface__1nDraw');
var org_jetbrains_skia_Surface__1nPeekPixels = Module['org_jetbrains_skia_Surface__1nPeekPixels'] = createExportWrapper('org_jetbrains_skia_Surface__1nPeekPixels');
var org_jetbrains_skia_Surface__1nNotifyContentWillChange = Module['org_jetbrains_skia_Surface__1nNotifyContentWillChange'] = createExportWrapper('org_jetbrains_skia_Surface__1nNotifyContentWillChange');
var org_jetbrains_skia_Surface__1nGetRecordingContext = Module['org_jetbrains_skia_Surface__1nGetRecordingContext'] = createExportWrapper('org_jetbrains_skia_Surface__1nGetRecordingContext');
var org_jetbrains_skia_paragraph_TypefaceFontProvider__1nMake = Module['org_jetbrains_skia_paragraph_TypefaceFontProvider__1nMake'] = createExportWrapper('org_jetbrains_skia_paragraph_TypefaceFontProvider__1nMake');
var org_jetbrains_skia_paragraph_TypefaceFontProviderWithFallback__1nMakeAsFallbackProvider = Module['org_jetbrains_skia_paragraph_TypefaceFontProviderWithFallback__1nMakeAsFallbackProvider'] = createExportWrapper('org_jetbrains_skia_paragraph_TypefaceFontProviderWithFallback__1nMakeAsFallbackProvider');
var org_jetbrains_skia_paragraph_TypefaceFontProvider__1nRegisterTypeface = Module['org_jetbrains_skia_paragraph_TypefaceFontProvider__1nRegisterTypeface'] = createExportWrapper('org_jetbrains_skia_paragraph_TypefaceFontProvider__1nRegisterTypeface');
var org_jetbrains_skia_paragraph_TypefaceFontProviderWithFallback__1nRegisterTypefaceForFallback = Module['org_jetbrains_skia_paragraph_TypefaceFontProviderWithFallback__1nRegisterTypefaceForFallback'] = createExportWrapper('org_jetbrains_skia_paragraph_TypefaceFontProviderWithFallback__1nRegisterTypefaceForFallback');
var org_jetbrains_skia_paragraph_TextBox__1nGetArraySize = Module['org_jetbrains_skia_paragraph_TextBox__1nGetArraySize'] = createExportWrapper('org_jetbrains_skia_paragraph_TextBox__1nGetArraySize');
var org_jetbrains_skia_paragraph_TextBox__1nDisposeArray = Module['org_jetbrains_skia_paragraph_TextBox__1nDisposeArray'] = createExportWrapper('org_jetbrains_skia_paragraph_TextBox__1nDisposeArray');
var org_jetbrains_skia_paragraph_TextBox__1nGetArrayElement = Module['org_jetbrains_skia_paragraph_TextBox__1nGetArrayElement'] = createExportWrapper('org_jetbrains_skia_paragraph_TextBox__1nGetArrayElement');
var org_jetbrains_skia_paragraph_Paragraph__1nGetFinalizer = Module['org_jetbrains_skia_paragraph_Paragraph__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nGetFinalizer');
var org_jetbrains_skia_paragraph_Paragraph__1nGetMaxWidth = Module['org_jetbrains_skia_paragraph_Paragraph__1nGetMaxWidth'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nGetMaxWidth');
var org_jetbrains_skia_paragraph_Paragraph__1nGetHeight = Module['org_jetbrains_skia_paragraph_Paragraph__1nGetHeight'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nGetHeight');
var org_jetbrains_skia_paragraph_Paragraph__1nGetMinIntrinsicWidth = Module['org_jetbrains_skia_paragraph_Paragraph__1nGetMinIntrinsicWidth'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nGetMinIntrinsicWidth');
var org_jetbrains_skia_paragraph_Paragraph__1nGetMaxIntrinsicWidth = Module['org_jetbrains_skia_paragraph_Paragraph__1nGetMaxIntrinsicWidth'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nGetMaxIntrinsicWidth');
var org_jetbrains_skia_paragraph_Paragraph__1nGetAlphabeticBaseline = Module['org_jetbrains_skia_paragraph_Paragraph__1nGetAlphabeticBaseline'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nGetAlphabeticBaseline');
var org_jetbrains_skia_paragraph_Paragraph__1nGetIdeographicBaseline = Module['org_jetbrains_skia_paragraph_Paragraph__1nGetIdeographicBaseline'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nGetIdeographicBaseline');
var org_jetbrains_skia_paragraph_Paragraph__1nGetLongestLine = Module['org_jetbrains_skia_paragraph_Paragraph__1nGetLongestLine'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nGetLongestLine');
var org_jetbrains_skia_paragraph_Paragraph__1nDidExceedMaxLines = Module['org_jetbrains_skia_paragraph_Paragraph__1nDidExceedMaxLines'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nDidExceedMaxLines');
var org_jetbrains_skia_paragraph_Paragraph__1nLayout = Module['org_jetbrains_skia_paragraph_Paragraph__1nLayout'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nLayout');
var org_jetbrains_skia_paragraph_Paragraph__1nPaint = Module['org_jetbrains_skia_paragraph_Paragraph__1nPaint'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nPaint');
var org_jetbrains_skia_paragraph_Paragraph__1nGetRectsForRange = Module['org_jetbrains_skia_paragraph_Paragraph__1nGetRectsForRange'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nGetRectsForRange');
var org_jetbrains_skia_paragraph_Paragraph__1nGetRectsForPlaceholders = Module['org_jetbrains_skia_paragraph_Paragraph__1nGetRectsForPlaceholders'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nGetRectsForPlaceholders');
var org_jetbrains_skia_paragraph_Paragraph__1nGetGlyphPositionAtCoordinate = Module['org_jetbrains_skia_paragraph_Paragraph__1nGetGlyphPositionAtCoordinate'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nGetGlyphPositionAtCoordinate');
var org_jetbrains_skia_paragraph_Paragraph__1nGetWordBoundary = Module['org_jetbrains_skia_paragraph_Paragraph__1nGetWordBoundary'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nGetWordBoundary');
var org_jetbrains_skia_paragraph_Paragraph__1nGetLineMetrics = Module['org_jetbrains_skia_paragraph_Paragraph__1nGetLineMetrics'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nGetLineMetrics');
var org_jetbrains_skia_paragraph_Paragraph__1nGetLineNumber = Module['org_jetbrains_skia_paragraph_Paragraph__1nGetLineNumber'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nGetLineNumber');
var org_jetbrains_skia_paragraph_Paragraph__1nMarkDirty = Module['org_jetbrains_skia_paragraph_Paragraph__1nMarkDirty'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nMarkDirty');
var org_jetbrains_skia_paragraph_Paragraph__1nGetUnresolvedGlyphsCount = Module['org_jetbrains_skia_paragraph_Paragraph__1nGetUnresolvedGlyphsCount'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nGetUnresolvedGlyphsCount');
var org_jetbrains_skia_paragraph_Paragraph__1nUpdateAlignment = Module['org_jetbrains_skia_paragraph_Paragraph__1nUpdateAlignment'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nUpdateAlignment');
var org_jetbrains_skia_paragraph_Paragraph__1nUpdateFontSize = Module['org_jetbrains_skia_paragraph_Paragraph__1nUpdateFontSize'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nUpdateFontSize');
var org_jetbrains_skia_paragraph_Paragraph__1nUpdateForegroundPaint = Module['org_jetbrains_skia_paragraph_Paragraph__1nUpdateForegroundPaint'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nUpdateForegroundPaint');
var org_jetbrains_skia_paragraph_Paragraph__1nUpdateBackgroundPaint = Module['org_jetbrains_skia_paragraph_Paragraph__1nUpdateBackgroundPaint'] = createExportWrapper('org_jetbrains_skia_paragraph_Paragraph__1nUpdateBackgroundPaint');
var org_jetbrains_skia_paragraph_ParagraphBuilder__1nMake = Module['org_jetbrains_skia_paragraph_ParagraphBuilder__1nMake'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphBuilder__1nMake');
var org_jetbrains_skia_paragraph_ParagraphBuilder__1nGetFinalizer = Module['org_jetbrains_skia_paragraph_ParagraphBuilder__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphBuilder__1nGetFinalizer');
var org_jetbrains_skia_paragraph_ParagraphBuilder__1nPushStyle = Module['org_jetbrains_skia_paragraph_ParagraphBuilder__1nPushStyle'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphBuilder__1nPushStyle');
var org_jetbrains_skia_paragraph_ParagraphBuilder__1nPopStyle = Module['org_jetbrains_skia_paragraph_ParagraphBuilder__1nPopStyle'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphBuilder__1nPopStyle');
var org_jetbrains_skia_paragraph_ParagraphBuilder__1nAddText = Module['org_jetbrains_skia_paragraph_ParagraphBuilder__1nAddText'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphBuilder__1nAddText');
var org_jetbrains_skia_paragraph_ParagraphBuilder__1nAddPlaceholder = Module['org_jetbrains_skia_paragraph_ParagraphBuilder__1nAddPlaceholder'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphBuilder__1nAddPlaceholder');
var org_jetbrains_skia_paragraph_ParagraphBuilder__1nBuild = Module['org_jetbrains_skia_paragraph_ParagraphBuilder__1nBuild'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphBuilder__1nBuild');
var org_jetbrains_skia_paragraph_StrutStyle__1nGetFinalizer = Module['org_jetbrains_skia_paragraph_StrutStyle__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nGetFinalizer');
var org_jetbrains_skia_paragraph_StrutStyle__1nMake = Module['org_jetbrains_skia_paragraph_StrutStyle__1nMake'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nMake');
var org_jetbrains_skia_paragraph_StrutStyle__1nEquals = Module['org_jetbrains_skia_paragraph_StrutStyle__1nEquals'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nEquals');
var org_jetbrains_skia_paragraph_StrutStyle__1nGetFontFamilies = Module['org_jetbrains_skia_paragraph_StrutStyle__1nGetFontFamilies'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nGetFontFamilies');
var org_jetbrains_skia_paragraph_StrutStyle__1nSetFontFamilies = Module['org_jetbrains_skia_paragraph_StrutStyle__1nSetFontFamilies'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nSetFontFamilies');
var org_jetbrains_skia_paragraph_StrutStyle__1nGetFontStyle = Module['org_jetbrains_skia_paragraph_StrutStyle__1nGetFontStyle'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nGetFontStyle');
var org_jetbrains_skia_paragraph_StrutStyle__1nSetFontStyle = Module['org_jetbrains_skia_paragraph_StrutStyle__1nSetFontStyle'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nSetFontStyle');
var org_jetbrains_skia_paragraph_StrutStyle__1nGetFontSize = Module['org_jetbrains_skia_paragraph_StrutStyle__1nGetFontSize'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nGetFontSize');
var org_jetbrains_skia_paragraph_StrutStyle__1nSetFontSize = Module['org_jetbrains_skia_paragraph_StrutStyle__1nSetFontSize'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nSetFontSize');
var org_jetbrains_skia_paragraph_StrutStyle__1nGetHeight = Module['org_jetbrains_skia_paragraph_StrutStyle__1nGetHeight'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nGetHeight');
var org_jetbrains_skia_paragraph_StrutStyle__1nSetHeight = Module['org_jetbrains_skia_paragraph_StrutStyle__1nSetHeight'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nSetHeight');
var org_jetbrains_skia_paragraph_StrutStyle__1nGetLeading = Module['org_jetbrains_skia_paragraph_StrutStyle__1nGetLeading'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nGetLeading');
var org_jetbrains_skia_paragraph_StrutStyle__1nSetLeading = Module['org_jetbrains_skia_paragraph_StrutStyle__1nSetLeading'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nSetLeading');
var org_jetbrains_skia_paragraph_StrutStyle__1nIsEnabled = Module['org_jetbrains_skia_paragraph_StrutStyle__1nIsEnabled'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nIsEnabled');
var org_jetbrains_skia_paragraph_StrutStyle__1nSetEnabled = Module['org_jetbrains_skia_paragraph_StrutStyle__1nSetEnabled'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nSetEnabled');
var org_jetbrains_skia_paragraph_StrutStyle__1nIsHeightForced = Module['org_jetbrains_skia_paragraph_StrutStyle__1nIsHeightForced'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nIsHeightForced');
var org_jetbrains_skia_paragraph_StrutStyle__1nSetHeightForced = Module['org_jetbrains_skia_paragraph_StrutStyle__1nSetHeightForced'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nSetHeightForced');
var org_jetbrains_skia_paragraph_StrutStyle__1nIsHeightOverridden = Module['org_jetbrains_skia_paragraph_StrutStyle__1nIsHeightOverridden'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nIsHeightOverridden');
var org_jetbrains_skia_paragraph_StrutStyle__1nSetHeightOverridden = Module['org_jetbrains_skia_paragraph_StrutStyle__1nSetHeightOverridden'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nSetHeightOverridden');
var org_jetbrains_skia_paragraph_StrutStyle__1nIsHalfLeading = Module['org_jetbrains_skia_paragraph_StrutStyle__1nIsHalfLeading'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nIsHalfLeading');
var org_jetbrains_skia_paragraph_StrutStyle__1nSetHalfLeading = Module['org_jetbrains_skia_paragraph_StrutStyle__1nSetHalfLeading'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nSetHalfLeading');
var org_jetbrains_skia_paragraph_StrutStyle__1nGetTopRatio = Module['org_jetbrains_skia_paragraph_StrutStyle__1nGetTopRatio'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nGetTopRatio');
var org_jetbrains_skia_paragraph_StrutStyle__1nSetTopRatio = Module['org_jetbrains_skia_paragraph_StrutStyle__1nSetTopRatio'] = createExportWrapper('org_jetbrains_skia_paragraph_StrutStyle__1nSetTopRatio');
var org_jetbrains_skia_paragraph_LineMetrics__1nGetArraySize = Module['org_jetbrains_skia_paragraph_LineMetrics__1nGetArraySize'] = createExportWrapper('org_jetbrains_skia_paragraph_LineMetrics__1nGetArraySize');
var org_jetbrains_skia_paragraph_LineMetrics__1nDisposeArray = Module['org_jetbrains_skia_paragraph_LineMetrics__1nDisposeArray'] = createExportWrapper('org_jetbrains_skia_paragraph_LineMetrics__1nDisposeArray');
var org_jetbrains_skia_paragraph_LineMetrics__1nGetArrayElement = Module['org_jetbrains_skia_paragraph_LineMetrics__1nGetArrayElement'] = createExportWrapper('org_jetbrains_skia_paragraph_LineMetrics__1nGetArrayElement');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nGetFinalizer = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nGetFinalizer');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nMake = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nMake'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nMake');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nEquals = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nEquals'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nEquals');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nGetStrutStyle = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nGetStrutStyle'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nGetStrutStyle');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nSetStrutStyle = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nSetStrutStyle'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nSetStrutStyle');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nGetTextStyle = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nGetTextStyle'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nGetTextStyle');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nSetTextStyle = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nSetTextStyle'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nSetTextStyle');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nGetDirection = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nGetDirection'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nGetDirection');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nSetDirection = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nSetDirection'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nSetDirection');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nGetAlignment = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nGetAlignment'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nGetAlignment');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nSetAlignment = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nSetAlignment'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nSetAlignment');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nGetMaxLinesCount = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nGetMaxLinesCount'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nGetMaxLinesCount');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nSetMaxLinesCount = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nSetMaxLinesCount'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nSetMaxLinesCount');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nGetEllipsis = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nGetEllipsis'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nGetEllipsis');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nSetEllipsis = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nSetEllipsis'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nSetEllipsis');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nGetHeight = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nGetHeight'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nGetHeight');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nSetHeight = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nSetHeight'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nSetHeight');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nGetHeightMode = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nGetHeightMode'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nGetHeightMode');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nSetHeightMode = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nSetHeightMode'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nSetHeightMode');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nGetEffectiveAlignment = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nGetEffectiveAlignment'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nGetEffectiveAlignment');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nIsHintingEnabled = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nIsHintingEnabled'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nIsHintingEnabled');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nDisableHinting = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nDisableHinting'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nDisableHinting');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nSetFontRastrSettings = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nSetFontRastrSettings'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nSetFontRastrSettings');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nGetEdging = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nGetEdging'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nGetEdging');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nGetHinting = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nGetHinting'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nGetHinting');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nGetSubpixel = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nGetSubpixel'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nGetSubpixel');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nGetApplyRoundingHack = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nGetApplyRoundingHack'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nGetApplyRoundingHack');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nSetApplyRoundingHack = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nSetApplyRoundingHack'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nSetApplyRoundingHack');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nSetTextIndent = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nSetTextIndent'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nSetTextIndent');
var org_jetbrains_skia_paragraph_ParagraphStyle__1nGetTextIndent = Module['org_jetbrains_skia_paragraph_ParagraphStyle__1nGetTextIndent'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphStyle__1nGetTextIndent');
var org_jetbrains_skia_paragraph_ParagraphCache__1nAbandon = Module['org_jetbrains_skia_paragraph_ParagraphCache__1nAbandon'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphCache__1nAbandon');
var org_jetbrains_skia_paragraph_ParagraphCache__1nReset = Module['org_jetbrains_skia_paragraph_ParagraphCache__1nReset'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphCache__1nReset');
var org_jetbrains_skia_paragraph_ParagraphCache__1nUpdateParagraph = Module['org_jetbrains_skia_paragraph_ParagraphCache__1nUpdateParagraph'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphCache__1nUpdateParagraph');
var org_jetbrains_skia_paragraph_ParagraphCache__1nFindParagraph = Module['org_jetbrains_skia_paragraph_ParagraphCache__1nFindParagraph'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphCache__1nFindParagraph');
var org_jetbrains_skia_paragraph_ParagraphCache__1nPrintStatistics = Module['org_jetbrains_skia_paragraph_ParagraphCache__1nPrintStatistics'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphCache__1nPrintStatistics');
var org_jetbrains_skia_paragraph_ParagraphCache__1nSetEnabled = Module['org_jetbrains_skia_paragraph_ParagraphCache__1nSetEnabled'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphCache__1nSetEnabled');
var org_jetbrains_skia_paragraph_ParagraphCache__1nGetCount = Module['org_jetbrains_skia_paragraph_ParagraphCache__1nGetCount'] = createExportWrapper('org_jetbrains_skia_paragraph_ParagraphCache__1nGetCount');
var org_jetbrains_skia_paragraph_TextStyle__1nMake = Module['org_jetbrains_skia_paragraph_TextStyle__1nMake'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nMake');
var org_jetbrains_skia_paragraph_TextStyle__1nGetFinalizer = Module['org_jetbrains_skia_paragraph_TextStyle__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nGetFinalizer');
var org_jetbrains_skia_paragraph_TextStyle__1nEquals = Module['org_jetbrains_skia_paragraph_TextStyle__1nEquals'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nEquals');
var org_jetbrains_skia_paragraph_TextStyle__1nAttributeEquals = Module['org_jetbrains_skia_paragraph_TextStyle__1nAttributeEquals'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nAttributeEquals');
var org_jetbrains_skia_paragraph_TextStyle__1nGetColor = Module['org_jetbrains_skia_paragraph_TextStyle__1nGetColor'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nGetColor');
var org_jetbrains_skia_paragraph_TextStyle__1nSetColor = Module['org_jetbrains_skia_paragraph_TextStyle__1nSetColor'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nSetColor');
var org_jetbrains_skia_paragraph_TextStyle__1nGetForeground = Module['org_jetbrains_skia_paragraph_TextStyle__1nGetForeground'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nGetForeground');
var org_jetbrains_skia_paragraph_TextStyle__1nSetForeground = Module['org_jetbrains_skia_paragraph_TextStyle__1nSetForeground'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nSetForeground');
var org_jetbrains_skia_paragraph_TextStyle__1nGetBackground = Module['org_jetbrains_skia_paragraph_TextStyle__1nGetBackground'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nGetBackground');
var org_jetbrains_skia_paragraph_TextStyle__1nSetBackground = Module['org_jetbrains_skia_paragraph_TextStyle__1nSetBackground'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nSetBackground');
var org_jetbrains_skia_paragraph_TextStyle__1nGetDecorationStyle = Module['org_jetbrains_skia_paragraph_TextStyle__1nGetDecorationStyle'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nGetDecorationStyle');
var org_jetbrains_skia_paragraph_TextStyle__1nSetDecorationStyle = Module['org_jetbrains_skia_paragraph_TextStyle__1nSetDecorationStyle'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nSetDecorationStyle');
var org_jetbrains_skia_paragraph_TextStyle__1nGetFontStyle = Module['org_jetbrains_skia_paragraph_TextStyle__1nGetFontStyle'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nGetFontStyle');
var org_jetbrains_skia_paragraph_TextStyle__1nSetFontStyle = Module['org_jetbrains_skia_paragraph_TextStyle__1nSetFontStyle'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nSetFontStyle');
var org_jetbrains_skia_paragraph_TextStyle__1nGetShadowsCount = Module['org_jetbrains_skia_paragraph_TextStyle__1nGetShadowsCount'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nGetShadowsCount');
var org_jetbrains_skia_paragraph_TextStyle__1nGetShadows = Module['org_jetbrains_skia_paragraph_TextStyle__1nGetShadows'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nGetShadows');
var org_jetbrains_skia_paragraph_TextStyle__1nAddShadow = Module['org_jetbrains_skia_paragraph_TextStyle__1nAddShadow'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nAddShadow');
var org_jetbrains_skia_paragraph_TextStyle__1nClearShadows = Module['org_jetbrains_skia_paragraph_TextStyle__1nClearShadows'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nClearShadows');
var org_jetbrains_skia_paragraph_TextStyle__1nGetFontFeaturesSize = Module['org_jetbrains_skia_paragraph_TextStyle__1nGetFontFeaturesSize'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nGetFontFeaturesSize');
var org_jetbrains_skia_paragraph_TextStyle__1nGetFontFeatures = Module['org_jetbrains_skia_paragraph_TextStyle__1nGetFontFeatures'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nGetFontFeatures');
var org_jetbrains_skia_paragraph_TextStyle__1nAddFontFeature = Module['org_jetbrains_skia_paragraph_TextStyle__1nAddFontFeature'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nAddFontFeature');
var org_jetbrains_skia_paragraph_TextStyle__1nClearFontFeatures = Module['org_jetbrains_skia_paragraph_TextStyle__1nClearFontFeatures'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nClearFontFeatures');
var org_jetbrains_skia_paragraph_TextStyle__1nGetFontSize = Module['org_jetbrains_skia_paragraph_TextStyle__1nGetFontSize'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nGetFontSize');
var org_jetbrains_skia_paragraph_TextStyle__1nSetFontSize = Module['org_jetbrains_skia_paragraph_TextStyle__1nSetFontSize'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nSetFontSize');
var org_jetbrains_skia_paragraph_TextStyle__1nGetFontFamilies = Module['org_jetbrains_skia_paragraph_TextStyle__1nGetFontFamilies'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nGetFontFamilies');
var org_jetbrains_skia_paragraph_TextStyle__1nSetFontFamilies = Module['org_jetbrains_skia_paragraph_TextStyle__1nSetFontFamilies'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nSetFontFamilies');
var org_jetbrains_skia_paragraph_TextStyle__1nGetHeight = Module['org_jetbrains_skia_paragraph_TextStyle__1nGetHeight'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nGetHeight');
var org_jetbrains_skia_paragraph_TextStyle__1nSetHeight = Module['org_jetbrains_skia_paragraph_TextStyle__1nSetHeight'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nSetHeight');
var org_jetbrains_skia_paragraph_TextStyle__1nGetHalfLeading = Module['org_jetbrains_skia_paragraph_TextStyle__1nGetHalfLeading'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nGetHalfLeading');
var org_jetbrains_skia_paragraph_TextStyle__1nSetHalfLeading = Module['org_jetbrains_skia_paragraph_TextStyle__1nSetHalfLeading'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nSetHalfLeading');
var org_jetbrains_skia_paragraph_TextStyle__1nGetTopRatio = Module['org_jetbrains_skia_paragraph_TextStyle__1nGetTopRatio'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nGetTopRatio');
var org_jetbrains_skia_paragraph_TextStyle__1nSetTopRatio = Module['org_jetbrains_skia_paragraph_TextStyle__1nSetTopRatio'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nSetTopRatio');
var org_jetbrains_skia_paragraph_TextStyle__1nGetBaselineShift = Module['org_jetbrains_skia_paragraph_TextStyle__1nGetBaselineShift'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nGetBaselineShift');
var org_jetbrains_skia_paragraph_TextStyle__1nSetBaselineShift = Module['org_jetbrains_skia_paragraph_TextStyle__1nSetBaselineShift'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nSetBaselineShift');
var org_jetbrains_skia_paragraph_TextStyle__1nGetLetterSpacing = Module['org_jetbrains_skia_paragraph_TextStyle__1nGetLetterSpacing'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nGetLetterSpacing');
var org_jetbrains_skia_paragraph_TextStyle__1nSetLetterSpacing = Module['org_jetbrains_skia_paragraph_TextStyle__1nSetLetterSpacing'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nSetLetterSpacing');
var org_jetbrains_skia_paragraph_TextStyle__1nGetWordSpacing = Module['org_jetbrains_skia_paragraph_TextStyle__1nGetWordSpacing'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nGetWordSpacing');
var org_jetbrains_skia_paragraph_TextStyle__1nSetWordSpacing = Module['org_jetbrains_skia_paragraph_TextStyle__1nSetWordSpacing'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nSetWordSpacing');
var org_jetbrains_skia_paragraph_TextStyle__1nGetTypeface = Module['org_jetbrains_skia_paragraph_TextStyle__1nGetTypeface'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nGetTypeface');
var org_jetbrains_skia_paragraph_TextStyle__1nSetTypeface = Module['org_jetbrains_skia_paragraph_TextStyle__1nSetTypeface'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nSetTypeface');
var org_jetbrains_skia_paragraph_TextStyle__1nGetLocale = Module['org_jetbrains_skia_paragraph_TextStyle__1nGetLocale'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nGetLocale');
var org_jetbrains_skia_paragraph_TextStyle__1nSetLocale = Module['org_jetbrains_skia_paragraph_TextStyle__1nSetLocale'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nSetLocale');
var org_jetbrains_skia_paragraph_TextStyle__1nGetBaselineMode = Module['org_jetbrains_skia_paragraph_TextStyle__1nGetBaselineMode'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nGetBaselineMode');
var org_jetbrains_skia_paragraph_TextStyle__1nSetBaselineMode = Module['org_jetbrains_skia_paragraph_TextStyle__1nSetBaselineMode'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nSetBaselineMode');
var org_jetbrains_skia_paragraph_TextStyle__1nGetFontMetrics = Module['org_jetbrains_skia_paragraph_TextStyle__1nGetFontMetrics'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nGetFontMetrics');
var org_jetbrains_skia_paragraph_TextStyle__1nIsPlaceholder = Module['org_jetbrains_skia_paragraph_TextStyle__1nIsPlaceholder'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nIsPlaceholder');
var org_jetbrains_skia_paragraph_TextStyle__1nSetPlaceholder = Module['org_jetbrains_skia_paragraph_TextStyle__1nSetPlaceholder'] = createExportWrapper('org_jetbrains_skia_paragraph_TextStyle__1nSetPlaceholder');
var org_jetbrains_skia_paragraph_FontCollection__1nMake = Module['org_jetbrains_skia_paragraph_FontCollection__1nMake'] = createExportWrapper('org_jetbrains_skia_paragraph_FontCollection__1nMake');
var org_jetbrains_skia_paragraph_FontCollection__1nGetFontManagersCount = Module['org_jetbrains_skia_paragraph_FontCollection__1nGetFontManagersCount'] = createExportWrapper('org_jetbrains_skia_paragraph_FontCollection__1nGetFontManagersCount');
var org_jetbrains_skia_paragraph_FontCollection__1nSetAssetFontManager = Module['org_jetbrains_skia_paragraph_FontCollection__1nSetAssetFontManager'] = createExportWrapper('org_jetbrains_skia_paragraph_FontCollection__1nSetAssetFontManager');
var org_jetbrains_skia_paragraph_FontCollection__1nSetDynamicFontManager = Module['org_jetbrains_skia_paragraph_FontCollection__1nSetDynamicFontManager'] = createExportWrapper('org_jetbrains_skia_paragraph_FontCollection__1nSetDynamicFontManager');
var org_jetbrains_skia_paragraph_FontCollection__1nSetTestFontManager = Module['org_jetbrains_skia_paragraph_FontCollection__1nSetTestFontManager'] = createExportWrapper('org_jetbrains_skia_paragraph_FontCollection__1nSetTestFontManager');
var org_jetbrains_skia_paragraph_FontCollection__1nSetDefaultFontManager = Module['org_jetbrains_skia_paragraph_FontCollection__1nSetDefaultFontManager'] = createExportWrapper('org_jetbrains_skia_paragraph_FontCollection__1nSetDefaultFontManager');
var org_jetbrains_skia_paragraph_FontCollection__1nGetFallbackManager = Module['org_jetbrains_skia_paragraph_FontCollection__1nGetFallbackManager'] = createExportWrapper('org_jetbrains_skia_paragraph_FontCollection__1nGetFallbackManager');
var org_jetbrains_skia_paragraph_FontCollection__1nFindTypefaces = Module['org_jetbrains_skia_paragraph_FontCollection__1nFindTypefaces'] = createExportWrapper('org_jetbrains_skia_paragraph_FontCollection__1nFindTypefaces');
var org_jetbrains_skia_paragraph_FontCollection__1nDefaultFallbackChar = Module['org_jetbrains_skia_paragraph_FontCollection__1nDefaultFallbackChar'] = createExportWrapper('org_jetbrains_skia_paragraph_FontCollection__1nDefaultFallbackChar');
var org_jetbrains_skia_paragraph_FontCollection__1nDefaultFallback = Module['org_jetbrains_skia_paragraph_FontCollection__1nDefaultFallback'] = createExportWrapper('org_jetbrains_skia_paragraph_FontCollection__1nDefaultFallback');
var org_jetbrains_skia_paragraph_FontCollection__1nSetEnableFallback = Module['org_jetbrains_skia_paragraph_FontCollection__1nSetEnableFallback'] = createExportWrapper('org_jetbrains_skia_paragraph_FontCollection__1nSetEnableFallback');
var org_jetbrains_skia_paragraph_FontCollection__1nGetParagraphCache = Module['org_jetbrains_skia_paragraph_FontCollection__1nGetParagraphCache'] = createExportWrapper('org_jetbrains_skia_paragraph_FontCollection__1nGetParagraphCache');
var org_jetbrains_skia_Path__1nGetFinalizer = Module['org_jetbrains_skia_Path__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_Path__1nGetFinalizer');
var org_jetbrains_skia_Path__1nMake = Module['org_jetbrains_skia_Path__1nMake'] = createExportWrapper('org_jetbrains_skia_Path__1nMake');
var org_jetbrains_skia_Path__1nMakeFromSVGString = Module['org_jetbrains_skia_Path__1nMakeFromSVGString'] = createExportWrapper('org_jetbrains_skia_Path__1nMakeFromSVGString');
var org_jetbrains_skia_Path__1nEquals = Module['org_jetbrains_skia_Path__1nEquals'] = createExportWrapper('org_jetbrains_skia_Path__1nEquals');
var org_jetbrains_skia_Path__1nIsInterpolatable = Module['org_jetbrains_skia_Path__1nIsInterpolatable'] = createExportWrapper('org_jetbrains_skia_Path__1nIsInterpolatable');
var org_jetbrains_skia_Path__1nMakeLerp = Module['org_jetbrains_skia_Path__1nMakeLerp'] = createExportWrapper('org_jetbrains_skia_Path__1nMakeLerp');
var org_jetbrains_skia_Path__1nGetFillMode = Module['org_jetbrains_skia_Path__1nGetFillMode'] = createExportWrapper('org_jetbrains_skia_Path__1nGetFillMode');
var org_jetbrains_skia_Path__1nSetFillMode = Module['org_jetbrains_skia_Path__1nSetFillMode'] = createExportWrapper('org_jetbrains_skia_Path__1nSetFillMode');
var org_jetbrains_skia_Path__1nIsConvex = Module['org_jetbrains_skia_Path__1nIsConvex'] = createExportWrapper('org_jetbrains_skia_Path__1nIsConvex');
var org_jetbrains_skia_Path__1nIsOval = Module['org_jetbrains_skia_Path__1nIsOval'] = createExportWrapper('org_jetbrains_skia_Path__1nIsOval');
var org_jetbrains_skia_Path__1nIsRRect = Module['org_jetbrains_skia_Path__1nIsRRect'] = createExportWrapper('org_jetbrains_skia_Path__1nIsRRect');
var org_jetbrains_skia_Path__1nReset = Module['org_jetbrains_skia_Path__1nReset'] = createExportWrapper('org_jetbrains_skia_Path__1nReset');
var org_jetbrains_skia_Path__1nRewind = Module['org_jetbrains_skia_Path__1nRewind'] = createExportWrapper('org_jetbrains_skia_Path__1nRewind');
var org_jetbrains_skia_Path__1nIsEmpty = Module['org_jetbrains_skia_Path__1nIsEmpty'] = createExportWrapper('org_jetbrains_skia_Path__1nIsEmpty');
var org_jetbrains_skia_Path__1nIsLastContourClosed = Module['org_jetbrains_skia_Path__1nIsLastContourClosed'] = createExportWrapper('org_jetbrains_skia_Path__1nIsLastContourClosed');
var org_jetbrains_skia_Path__1nIsFinite = Module['org_jetbrains_skia_Path__1nIsFinite'] = createExportWrapper('org_jetbrains_skia_Path__1nIsFinite');
var org_jetbrains_skia_Path__1nIsVolatile = Module['org_jetbrains_skia_Path__1nIsVolatile'] = createExportWrapper('org_jetbrains_skia_Path__1nIsVolatile');
var org_jetbrains_skia_Path__1nSetVolatile = Module['org_jetbrains_skia_Path__1nSetVolatile'] = createExportWrapper('org_jetbrains_skia_Path__1nSetVolatile');
var org_jetbrains_skia_Path__1nIsLineDegenerate = Module['org_jetbrains_skia_Path__1nIsLineDegenerate'] = createExportWrapper('org_jetbrains_skia_Path__1nIsLineDegenerate');
var org_jetbrains_skia_Path__1nIsQuadDegenerate = Module['org_jetbrains_skia_Path__1nIsQuadDegenerate'] = createExportWrapper('org_jetbrains_skia_Path__1nIsQuadDegenerate');
var org_jetbrains_skia_Path__1nIsCubicDegenerate = Module['org_jetbrains_skia_Path__1nIsCubicDegenerate'] = createExportWrapper('org_jetbrains_skia_Path__1nIsCubicDegenerate');
var org_jetbrains_skia_Path__1nMaybeGetAsLine = Module['org_jetbrains_skia_Path__1nMaybeGetAsLine'] = createExportWrapper('org_jetbrains_skia_Path__1nMaybeGetAsLine');
var org_jetbrains_skia_Path__1nGetPointsCount = Module['org_jetbrains_skia_Path__1nGetPointsCount'] = createExportWrapper('org_jetbrains_skia_Path__1nGetPointsCount');
var org_jetbrains_skia_Path__1nGetPoint = Module['org_jetbrains_skia_Path__1nGetPoint'] = createExportWrapper('org_jetbrains_skia_Path__1nGetPoint');
var org_jetbrains_skia_Path__1nGetPoints = Module['org_jetbrains_skia_Path__1nGetPoints'] = createExportWrapper('org_jetbrains_skia_Path__1nGetPoints');
var org_jetbrains_skia_Path__1nCountVerbs = Module['org_jetbrains_skia_Path__1nCountVerbs'] = createExportWrapper('org_jetbrains_skia_Path__1nCountVerbs');
var org_jetbrains_skia_Path__1nGetVerbs = Module['org_jetbrains_skia_Path__1nGetVerbs'] = createExportWrapper('org_jetbrains_skia_Path__1nGetVerbs');
var org_jetbrains_skia_Path__1nApproximateBytesUsed = Module['org_jetbrains_skia_Path__1nApproximateBytesUsed'] = createExportWrapper('org_jetbrains_skia_Path__1nApproximateBytesUsed');
var org_jetbrains_skia_Path__1nSwap = Module['org_jetbrains_skia_Path__1nSwap'] = createExportWrapper('org_jetbrains_skia_Path__1nSwap');
var org_jetbrains_skia_Path__1nGetBounds = Module['org_jetbrains_skia_Path__1nGetBounds'] = createExportWrapper('org_jetbrains_skia_Path__1nGetBounds');
var org_jetbrains_skia_Path__1nUpdateBoundsCache = Module['org_jetbrains_skia_Path__1nUpdateBoundsCache'] = createExportWrapper('org_jetbrains_skia_Path__1nUpdateBoundsCache');
var org_jetbrains_skia_Path__1nComputeTightBounds = Module['org_jetbrains_skia_Path__1nComputeTightBounds'] = createExportWrapper('org_jetbrains_skia_Path__1nComputeTightBounds');
var org_jetbrains_skia_Path__1nConservativelyContainsRect = Module['org_jetbrains_skia_Path__1nConservativelyContainsRect'] = createExportWrapper('org_jetbrains_skia_Path__1nConservativelyContainsRect');
var org_jetbrains_skia_Path__1nIncReserve = Module['org_jetbrains_skia_Path__1nIncReserve'] = createExportWrapper('org_jetbrains_skia_Path__1nIncReserve');
var org_jetbrains_skia_Path__1nMoveTo = Module['org_jetbrains_skia_Path__1nMoveTo'] = createExportWrapper('org_jetbrains_skia_Path__1nMoveTo');
var org_jetbrains_skia_Path__1nRMoveTo = Module['org_jetbrains_skia_Path__1nRMoveTo'] = createExportWrapper('org_jetbrains_skia_Path__1nRMoveTo');
var org_jetbrains_skia_Path__1nLineTo = Module['org_jetbrains_skia_Path__1nLineTo'] = createExportWrapper('org_jetbrains_skia_Path__1nLineTo');
var org_jetbrains_skia_Path__1nRLineTo = Module['org_jetbrains_skia_Path__1nRLineTo'] = createExportWrapper('org_jetbrains_skia_Path__1nRLineTo');
var org_jetbrains_skia_Path__1nQuadTo = Module['org_jetbrains_skia_Path__1nQuadTo'] = createExportWrapper('org_jetbrains_skia_Path__1nQuadTo');
var org_jetbrains_skia_Path__1nRQuadTo = Module['org_jetbrains_skia_Path__1nRQuadTo'] = createExportWrapper('org_jetbrains_skia_Path__1nRQuadTo');
var org_jetbrains_skia_Path__1nConicTo = Module['org_jetbrains_skia_Path__1nConicTo'] = createExportWrapper('org_jetbrains_skia_Path__1nConicTo');
var org_jetbrains_skia_Path__1nRConicTo = Module['org_jetbrains_skia_Path__1nRConicTo'] = createExportWrapper('org_jetbrains_skia_Path__1nRConicTo');
var org_jetbrains_skia_Path__1nCubicTo = Module['org_jetbrains_skia_Path__1nCubicTo'] = createExportWrapper('org_jetbrains_skia_Path__1nCubicTo');
var org_jetbrains_skia_Path__1nRCubicTo = Module['org_jetbrains_skia_Path__1nRCubicTo'] = createExportWrapper('org_jetbrains_skia_Path__1nRCubicTo');
var org_jetbrains_skia_Path__1nArcTo = Module['org_jetbrains_skia_Path__1nArcTo'] = createExportWrapper('org_jetbrains_skia_Path__1nArcTo');
var org_jetbrains_skia_Path__1nTangentArcTo = Module['org_jetbrains_skia_Path__1nTangentArcTo'] = createExportWrapper('org_jetbrains_skia_Path__1nTangentArcTo');
var org_jetbrains_skia_Path__1nEllipticalArcTo = Module['org_jetbrains_skia_Path__1nEllipticalArcTo'] = createExportWrapper('org_jetbrains_skia_Path__1nEllipticalArcTo');
var org_jetbrains_skia_Path__1nREllipticalArcTo = Module['org_jetbrains_skia_Path__1nREllipticalArcTo'] = createExportWrapper('org_jetbrains_skia_Path__1nREllipticalArcTo');
var org_jetbrains_skia_Path__1nClosePath = Module['org_jetbrains_skia_Path__1nClosePath'] = createExportWrapper('org_jetbrains_skia_Path__1nClosePath');
var org_jetbrains_skia_Path__1nConvertConicToQuads = Module['org_jetbrains_skia_Path__1nConvertConicToQuads'] = createExportWrapper('org_jetbrains_skia_Path__1nConvertConicToQuads');
var org_jetbrains_skia_Path__1nIsRect = Module['org_jetbrains_skia_Path__1nIsRect'] = createExportWrapper('org_jetbrains_skia_Path__1nIsRect');
var org_jetbrains_skia_Path__1nAddRect = Module['org_jetbrains_skia_Path__1nAddRect'] = createExportWrapper('org_jetbrains_skia_Path__1nAddRect');
var org_jetbrains_skia_Path__1nAddOval = Module['org_jetbrains_skia_Path__1nAddOval'] = createExportWrapper('org_jetbrains_skia_Path__1nAddOval');
var org_jetbrains_skia_Path__1nAddCircle = Module['org_jetbrains_skia_Path__1nAddCircle'] = createExportWrapper('org_jetbrains_skia_Path__1nAddCircle');
var org_jetbrains_skia_Path__1nAddArc = Module['org_jetbrains_skia_Path__1nAddArc'] = createExportWrapper('org_jetbrains_skia_Path__1nAddArc');
var org_jetbrains_skia_Path__1nAddRRect = Module['org_jetbrains_skia_Path__1nAddRRect'] = createExportWrapper('org_jetbrains_skia_Path__1nAddRRect');
var org_jetbrains_skia_Path__1nAddPoly = Module['org_jetbrains_skia_Path__1nAddPoly'] = createExportWrapper('org_jetbrains_skia_Path__1nAddPoly');
var org_jetbrains_skia_Path__1nAddPath = Module['org_jetbrains_skia_Path__1nAddPath'] = createExportWrapper('org_jetbrains_skia_Path__1nAddPath');
var org_jetbrains_skia_Path__1nAddPathOffset = Module['org_jetbrains_skia_Path__1nAddPathOffset'] = createExportWrapper('org_jetbrains_skia_Path__1nAddPathOffset');
var org_jetbrains_skia_Path__1nAddPathTransform = Module['org_jetbrains_skia_Path__1nAddPathTransform'] = createExportWrapper('org_jetbrains_skia_Path__1nAddPathTransform');
var org_jetbrains_skia_Path__1nReverseAddPath = Module['org_jetbrains_skia_Path__1nReverseAddPath'] = createExportWrapper('org_jetbrains_skia_Path__1nReverseAddPath');
var org_jetbrains_skia_Path__1nOffset = Module['org_jetbrains_skia_Path__1nOffset'] = createExportWrapper('org_jetbrains_skia_Path__1nOffset');
var org_jetbrains_skia_Path__1nTransform = Module['org_jetbrains_skia_Path__1nTransform'] = createExportWrapper('org_jetbrains_skia_Path__1nTransform');
var org_jetbrains_skia_Path__1nGetLastPt = Module['org_jetbrains_skia_Path__1nGetLastPt'] = createExportWrapper('org_jetbrains_skia_Path__1nGetLastPt');
var org_jetbrains_skia_Path__1nSetLastPt = Module['org_jetbrains_skia_Path__1nSetLastPt'] = createExportWrapper('org_jetbrains_skia_Path__1nSetLastPt');
var org_jetbrains_skia_Path__1nGetSegmentMasks = Module['org_jetbrains_skia_Path__1nGetSegmentMasks'] = createExportWrapper('org_jetbrains_skia_Path__1nGetSegmentMasks');
var org_jetbrains_skia_Path__1nContains = Module['org_jetbrains_skia_Path__1nContains'] = createExportWrapper('org_jetbrains_skia_Path__1nContains');
var org_jetbrains_skia_Path__1nDump = Module['org_jetbrains_skia_Path__1nDump'] = createExportWrapper('org_jetbrains_skia_Path__1nDump');
var org_jetbrains_skia_Path__1nDumpHex = Module['org_jetbrains_skia_Path__1nDumpHex'] = createExportWrapper('org_jetbrains_skia_Path__1nDumpHex');
var org_jetbrains_skia_Path__1nSerializeToBytes = Module['org_jetbrains_skia_Path__1nSerializeToBytes'] = createExportWrapper('org_jetbrains_skia_Path__1nSerializeToBytes');
var org_jetbrains_skia_Path__1nMakeCombining = Module['org_jetbrains_skia_Path__1nMakeCombining'] = createExportWrapper('org_jetbrains_skia_Path__1nMakeCombining');
var org_jetbrains_skia_Path__1nMakeFromBytes = Module['org_jetbrains_skia_Path__1nMakeFromBytes'] = createExportWrapper('org_jetbrains_skia_Path__1nMakeFromBytes');
var org_jetbrains_skia_Path__1nGetGenerationId = Module['org_jetbrains_skia_Path__1nGetGenerationId'] = createExportWrapper('org_jetbrains_skia_Path__1nGetGenerationId');
var org_jetbrains_skia_Path__1nIsValid = Module['org_jetbrains_skia_Path__1nIsValid'] = createExportWrapper('org_jetbrains_skia_Path__1nIsValid');
var org_jetbrains_skia_Data__1nGetFinalizer = Module['org_jetbrains_skia_Data__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_Data__1nGetFinalizer');
var org_jetbrains_skia_Data__1nSize = Module['org_jetbrains_skia_Data__1nSize'] = createExportWrapper('org_jetbrains_skia_Data__1nSize');
var org_jetbrains_skia_Data__1nBytes = Module['org_jetbrains_skia_Data__1nBytes'] = createExportWrapper('org_jetbrains_skia_Data__1nBytes');
var org_jetbrains_skia_Data__1nEquals = Module['org_jetbrains_skia_Data__1nEquals'] = createExportWrapper('org_jetbrains_skia_Data__1nEquals');
var org_jetbrains_skia_Data__1nMakeFromBytes = Module['org_jetbrains_skia_Data__1nMakeFromBytes'] = createExportWrapper('org_jetbrains_skia_Data__1nMakeFromBytes');
var org_jetbrains_skia_Data__1nMakeWithoutCopy = Module['org_jetbrains_skia_Data__1nMakeWithoutCopy'] = createExportWrapper('org_jetbrains_skia_Data__1nMakeWithoutCopy');
var org_jetbrains_skia_Data__1nMakeFromFileName = Module['org_jetbrains_skia_Data__1nMakeFromFileName'] = createExportWrapper('org_jetbrains_skia_Data__1nMakeFromFileName');
var org_jetbrains_skia_Data__1nMakeSubset = Module['org_jetbrains_skia_Data__1nMakeSubset'] = createExportWrapper('org_jetbrains_skia_Data__1nMakeSubset');
var org_jetbrains_skia_Data__1nMakeEmpty = Module['org_jetbrains_skia_Data__1nMakeEmpty'] = createExportWrapper('org_jetbrains_skia_Data__1nMakeEmpty');
var org_jetbrains_skia_Data__1nMakeUninitialized = Module['org_jetbrains_skia_Data__1nMakeUninitialized'] = createExportWrapper('org_jetbrains_skia_Data__1nMakeUninitialized');
var org_jetbrains_skia_Data__1nWritableData = Module['org_jetbrains_skia_Data__1nWritableData'] = createExportWrapper('org_jetbrains_skia_Data__1nWritableData');
var org_jetbrains_skia_PathMeasure__1nGetFinalizer = Module['org_jetbrains_skia_PathMeasure__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_PathMeasure__1nGetFinalizer');
var org_jetbrains_skia_PathMeasure__1nMake = Module['org_jetbrains_skia_PathMeasure__1nMake'] = createExportWrapper('org_jetbrains_skia_PathMeasure__1nMake');
var org_jetbrains_skia_PathMeasure__1nMakePath = Module['org_jetbrains_skia_PathMeasure__1nMakePath'] = createExportWrapper('org_jetbrains_skia_PathMeasure__1nMakePath');
var org_jetbrains_skia_PathMeasure__1nSetPath = Module['org_jetbrains_skia_PathMeasure__1nSetPath'] = createExportWrapper('org_jetbrains_skia_PathMeasure__1nSetPath');
var org_jetbrains_skia_PathMeasure__1nGetLength = Module['org_jetbrains_skia_PathMeasure__1nGetLength'] = createExportWrapper('org_jetbrains_skia_PathMeasure__1nGetLength');
var org_jetbrains_skia_PathMeasure__1nGetPosition = Module['org_jetbrains_skia_PathMeasure__1nGetPosition'] = createExportWrapper('org_jetbrains_skia_PathMeasure__1nGetPosition');
var org_jetbrains_skia_PathMeasure__1nGetTangent = Module['org_jetbrains_skia_PathMeasure__1nGetTangent'] = createExportWrapper('org_jetbrains_skia_PathMeasure__1nGetTangent');
var org_jetbrains_skia_PathMeasure__1nGetRSXform = Module['org_jetbrains_skia_PathMeasure__1nGetRSXform'] = createExportWrapper('org_jetbrains_skia_PathMeasure__1nGetRSXform');
var org_jetbrains_skia_PathMeasure__1nGetMatrix = Module['org_jetbrains_skia_PathMeasure__1nGetMatrix'] = createExportWrapper('org_jetbrains_skia_PathMeasure__1nGetMatrix');
var org_jetbrains_skia_PathMeasure__1nGetSegment = Module['org_jetbrains_skia_PathMeasure__1nGetSegment'] = createExportWrapper('org_jetbrains_skia_PathMeasure__1nGetSegment');
var org_jetbrains_skia_PathMeasure__1nIsClosed = Module['org_jetbrains_skia_PathMeasure__1nIsClosed'] = createExportWrapper('org_jetbrains_skia_PathMeasure__1nIsClosed');
var org_jetbrains_skia_PathMeasure__1nNextContour = Module['org_jetbrains_skia_PathMeasure__1nNextContour'] = createExportWrapper('org_jetbrains_skia_PathMeasure__1nNextContour');
var org_jetbrains_skia_TextLine__1nGetFinalizer = Module['org_jetbrains_skia_TextLine__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_TextLine__1nGetFinalizer');
var org_jetbrains_skia_TextLine__1nGetAscent = Module['org_jetbrains_skia_TextLine__1nGetAscent'] = createExportWrapper('org_jetbrains_skia_TextLine__1nGetAscent');
var org_jetbrains_skia_TextLine__1nGetCapHeight = Module['org_jetbrains_skia_TextLine__1nGetCapHeight'] = createExportWrapper('org_jetbrains_skia_TextLine__1nGetCapHeight');
var org_jetbrains_skia_TextLine__1nGetXHeight = Module['org_jetbrains_skia_TextLine__1nGetXHeight'] = createExportWrapper('org_jetbrains_skia_TextLine__1nGetXHeight');
var org_jetbrains_skia_TextLine__1nGetDescent = Module['org_jetbrains_skia_TextLine__1nGetDescent'] = createExportWrapper('org_jetbrains_skia_TextLine__1nGetDescent');
var org_jetbrains_skia_TextLine__1nGetLeading = Module['org_jetbrains_skia_TextLine__1nGetLeading'] = createExportWrapper('org_jetbrains_skia_TextLine__1nGetLeading');
var org_jetbrains_skia_TextLine__1nGetWidth = Module['org_jetbrains_skia_TextLine__1nGetWidth'] = createExportWrapper('org_jetbrains_skia_TextLine__1nGetWidth');
var org_jetbrains_skia_TextLine__1nGetHeight = Module['org_jetbrains_skia_TextLine__1nGetHeight'] = createExportWrapper('org_jetbrains_skia_TextLine__1nGetHeight');
var org_jetbrains_skia_TextLine__1nGetTextBlob = Module['org_jetbrains_skia_TextLine__1nGetTextBlob'] = createExportWrapper('org_jetbrains_skia_TextLine__1nGetTextBlob');
var org_jetbrains_skia_TextLine__1nGetGlyphsLength = Module['org_jetbrains_skia_TextLine__1nGetGlyphsLength'] = createExportWrapper('org_jetbrains_skia_TextLine__1nGetGlyphsLength');
var org_jetbrains_skia_TextLine__1nGetGlyphs = Module['org_jetbrains_skia_TextLine__1nGetGlyphs'] = createExportWrapper('org_jetbrains_skia_TextLine__1nGetGlyphs');
var org_jetbrains_skia_TextLine__1nGetPositions = Module['org_jetbrains_skia_TextLine__1nGetPositions'] = createExportWrapper('org_jetbrains_skia_TextLine__1nGetPositions');
var org_jetbrains_skia_TextLine__1nGetRunPositionsCount = Module['org_jetbrains_skia_TextLine__1nGetRunPositionsCount'] = createExportWrapper('org_jetbrains_skia_TextLine__1nGetRunPositionsCount');
var org_jetbrains_skia_TextLine__1nGetRunPositions = Module['org_jetbrains_skia_TextLine__1nGetRunPositions'] = createExportWrapper('org_jetbrains_skia_TextLine__1nGetRunPositions');
var org_jetbrains_skia_TextLine__1nGetBreakPositionsCount = Module['org_jetbrains_skia_TextLine__1nGetBreakPositionsCount'] = createExportWrapper('org_jetbrains_skia_TextLine__1nGetBreakPositionsCount');
var org_jetbrains_skia_TextLine__1nGetBreakPositions = Module['org_jetbrains_skia_TextLine__1nGetBreakPositions'] = createExportWrapper('org_jetbrains_skia_TextLine__1nGetBreakPositions');
var org_jetbrains_skia_TextLine__1nGetBreakOffsetsCount = Module['org_jetbrains_skia_TextLine__1nGetBreakOffsetsCount'] = createExportWrapper('org_jetbrains_skia_TextLine__1nGetBreakOffsetsCount');
var org_jetbrains_skia_TextLine__1nGetBreakOffsets = Module['org_jetbrains_skia_TextLine__1nGetBreakOffsets'] = createExportWrapper('org_jetbrains_skia_TextLine__1nGetBreakOffsets');
var org_jetbrains_skia_TextLine__1nGetOffsetAtCoord = Module['org_jetbrains_skia_TextLine__1nGetOffsetAtCoord'] = createExportWrapper('org_jetbrains_skia_TextLine__1nGetOffsetAtCoord');
var org_jetbrains_skia_TextLine__1nGetLeftOffsetAtCoord = Module['org_jetbrains_skia_TextLine__1nGetLeftOffsetAtCoord'] = createExportWrapper('org_jetbrains_skia_TextLine__1nGetLeftOffsetAtCoord');
var org_jetbrains_skia_TextLine__1nGetCoordAtOffset = Module['org_jetbrains_skia_TextLine__1nGetCoordAtOffset'] = createExportWrapper('org_jetbrains_skia_TextLine__1nGetCoordAtOffset');
var org_jetbrains_skia_PathEffect__1nMakeSum = Module['org_jetbrains_skia_PathEffect__1nMakeSum'] = createExportWrapper('org_jetbrains_skia_PathEffect__1nMakeSum');
var org_jetbrains_skia_PathEffect__1nMakeCompose = Module['org_jetbrains_skia_PathEffect__1nMakeCompose'] = createExportWrapper('org_jetbrains_skia_PathEffect__1nMakeCompose');
var org_jetbrains_skia_PathEffect__1nMakePath1D = Module['org_jetbrains_skia_PathEffect__1nMakePath1D'] = createExportWrapper('org_jetbrains_skia_PathEffect__1nMakePath1D');
var org_jetbrains_skia_PathEffect__1nMakePath2D = Module['org_jetbrains_skia_PathEffect__1nMakePath2D'] = createExportWrapper('org_jetbrains_skia_PathEffect__1nMakePath2D');
var org_jetbrains_skia_PathEffect__1nMakeLine2D = Module['org_jetbrains_skia_PathEffect__1nMakeLine2D'] = createExportWrapper('org_jetbrains_skia_PathEffect__1nMakeLine2D');
var org_jetbrains_skia_PathEffect__1nMakeCorner = Module['org_jetbrains_skia_PathEffect__1nMakeCorner'] = createExportWrapper('org_jetbrains_skia_PathEffect__1nMakeCorner');
var org_jetbrains_skia_PathEffect__1nMakeDash = Module['org_jetbrains_skia_PathEffect__1nMakeDash'] = createExportWrapper('org_jetbrains_skia_PathEffect__1nMakeDash');
var org_jetbrains_skia_PathEffect__1nMakeDiscrete = Module['org_jetbrains_skia_PathEffect__1nMakeDiscrete'] = createExportWrapper('org_jetbrains_skia_PathEffect__1nMakeDiscrete');
var org_jetbrains_skia_BackendRenderTarget__1nGetFinalizer = Module['org_jetbrains_skia_BackendRenderTarget__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_BackendRenderTarget__1nGetFinalizer');
var org_jetbrains_skia_BackendRenderTarget__1nMakeGL = Module['org_jetbrains_skia_BackendRenderTarget__1nMakeGL'] = createExportWrapper('org_jetbrains_skia_BackendRenderTarget__1nMakeGL');
var _BackendRenderTarget_nMakeMetal = Module['_BackendRenderTarget_nMakeMetal'] = createExportWrapper('BackendRenderTarget_nMakeMetal');
var _BackendRenderTarget_MakeDirect3D = Module['_BackendRenderTarget_MakeDirect3D'] = createExportWrapper('BackendRenderTarget_MakeDirect3D');
var org_jetbrains_skia_RuntimeShaderBuilder__1nGetFinalizer = Module['org_jetbrains_skia_RuntimeShaderBuilder__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_RuntimeShaderBuilder__1nGetFinalizer');
var org_jetbrains_skia_RuntimeShaderBuilder__1nMakeFromRuntimeEffect = Module['org_jetbrains_skia_RuntimeShaderBuilder__1nMakeFromRuntimeEffect'] = createExportWrapper('org_jetbrains_skia_RuntimeShaderBuilder__1nMakeFromRuntimeEffect');
var org_jetbrains_skia_RuntimeShaderBuilder__1nUniformInt = Module['org_jetbrains_skia_RuntimeShaderBuilder__1nUniformInt'] = createExportWrapper('org_jetbrains_skia_RuntimeShaderBuilder__1nUniformInt');
var org_jetbrains_skia_RuntimeShaderBuilder__1nUniformInt2 = Module['org_jetbrains_skia_RuntimeShaderBuilder__1nUniformInt2'] = createExportWrapper('org_jetbrains_skia_RuntimeShaderBuilder__1nUniformInt2');
var org_jetbrains_skia_RuntimeShaderBuilder__1nUniformInt3 = Module['org_jetbrains_skia_RuntimeShaderBuilder__1nUniformInt3'] = createExportWrapper('org_jetbrains_skia_RuntimeShaderBuilder__1nUniformInt3');
var org_jetbrains_skia_RuntimeShaderBuilder__1nUniformInt4 = Module['org_jetbrains_skia_RuntimeShaderBuilder__1nUniformInt4'] = createExportWrapper('org_jetbrains_skia_RuntimeShaderBuilder__1nUniformInt4');
var org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloat = Module['org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloat'] = createExportWrapper('org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloat');
var org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloat2 = Module['org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloat2'] = createExportWrapper('org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloat2');
var org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloat3 = Module['org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloat3'] = createExportWrapper('org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloat3');
var org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloat4 = Module['org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloat4'] = createExportWrapper('org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloat4');
var org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloatArray = Module['org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloatArray'] = createExportWrapper('org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloatArray');
var org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloatMatrix22 = Module['org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloatMatrix22'] = createExportWrapper('org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloatMatrix22');
var org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloatMatrix33 = Module['org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloatMatrix33'] = createExportWrapper('org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloatMatrix33');
var org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloatMatrix44 = Module['org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloatMatrix44'] = createExportWrapper('org_jetbrains_skia_RuntimeShaderBuilder__1nUniformFloatMatrix44');
var org_jetbrains_skia_RuntimeShaderBuilder__1nChildShader = Module['org_jetbrains_skia_RuntimeShaderBuilder__1nChildShader'] = createExportWrapper('org_jetbrains_skia_RuntimeShaderBuilder__1nChildShader');
var org_jetbrains_skia_RuntimeShaderBuilder__1nChildColorFilter = Module['org_jetbrains_skia_RuntimeShaderBuilder__1nChildColorFilter'] = createExportWrapper('org_jetbrains_skia_RuntimeShaderBuilder__1nChildColorFilter');
var org_jetbrains_skia_RuntimeShaderBuilder__1nMakeShader = Module['org_jetbrains_skia_RuntimeShaderBuilder__1nMakeShader'] = createExportWrapper('org_jetbrains_skia_RuntimeShaderBuilder__1nMakeShader');
var org_jetbrains_skia_RTreeFactory__1nMake = Module['org_jetbrains_skia_RTreeFactory__1nMake'] = createExportWrapper('org_jetbrains_skia_RTreeFactory__1nMake');
var org_jetbrains_skia_BBHFactory__1nGetFinalizer = Module['org_jetbrains_skia_BBHFactory__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_BBHFactory__1nGetFinalizer');
var org_jetbrains_skia_PixelRef__1nGetWidth = Module['org_jetbrains_skia_PixelRef__1nGetWidth'] = createExportWrapper('org_jetbrains_skia_PixelRef__1nGetWidth');
var org_jetbrains_skia_PixelRef__1nGetHeight = Module['org_jetbrains_skia_PixelRef__1nGetHeight'] = createExportWrapper('org_jetbrains_skia_PixelRef__1nGetHeight');
var org_jetbrains_skia_PixelRef__1nGetRowBytes = Module['org_jetbrains_skia_PixelRef__1nGetRowBytes'] = createExportWrapper('org_jetbrains_skia_PixelRef__1nGetRowBytes');
var org_jetbrains_skia_PixelRef__1nGetGenerationId = Module['org_jetbrains_skia_PixelRef__1nGetGenerationId'] = createExportWrapper('org_jetbrains_skia_PixelRef__1nGetGenerationId');
var org_jetbrains_skia_PixelRef__1nNotifyPixelsChanged = Module['org_jetbrains_skia_PixelRef__1nNotifyPixelsChanged'] = createExportWrapper('org_jetbrains_skia_PixelRef__1nNotifyPixelsChanged');
var org_jetbrains_skia_PixelRef__1nIsImmutable = Module['org_jetbrains_skia_PixelRef__1nIsImmutable'] = createExportWrapper('org_jetbrains_skia_PixelRef__1nIsImmutable');
var org_jetbrains_skia_PixelRef__1nSetImmutable = Module['org_jetbrains_skia_PixelRef__1nSetImmutable'] = createExportWrapper('org_jetbrains_skia_PixelRef__1nSetImmutable');
var org_jetbrains_skia_U16String__1nGetFinalizer = Module['org_jetbrains_skia_U16String__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_U16String__1nGetFinalizer');
var org_jetbrains_skia_shaper_ManagedRunIterator__1nGetFinalizer = Module['org_jetbrains_skia_shaper_ManagedRunIterator__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_shaper_ManagedRunIterator__1nGetFinalizer');
var org_jetbrains_skia_shaper_ManagedRunIterator__1nConsume = Module['org_jetbrains_skia_shaper_ManagedRunIterator__1nConsume'] = createExportWrapper('org_jetbrains_skia_shaper_ManagedRunIterator__1nConsume');
var org_jetbrains_skia_shaper_ManagedRunIterator__1nGetEndOfCurrentRun = Module['org_jetbrains_skia_shaper_ManagedRunIterator__1nGetEndOfCurrentRun'] = createExportWrapper('org_jetbrains_skia_shaper_ManagedRunIterator__1nGetEndOfCurrentRun');
var org_jetbrains_skia_shaper_ManagedRunIterator__1nIsAtEnd = Module['org_jetbrains_skia_shaper_ManagedRunIterator__1nIsAtEnd'] = createExportWrapper('org_jetbrains_skia_shaper_ManagedRunIterator__1nIsAtEnd');
var org_jetbrains_skia_shaper_Shaper__1nGetFinalizer = Module['org_jetbrains_skia_shaper_Shaper__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_shaper_Shaper__1nGetFinalizer');
var org_jetbrains_skia_shaper_Shaper__1nMakePrimitive = Module['org_jetbrains_skia_shaper_Shaper__1nMakePrimitive'] = createExportWrapper('org_jetbrains_skia_shaper_Shaper__1nMakePrimitive');
var org_jetbrains_skia_shaper_Shaper__1nMakeShaperDrivenWrapper = Module['org_jetbrains_skia_shaper_Shaper__1nMakeShaperDrivenWrapper'] = createExportWrapper('org_jetbrains_skia_shaper_Shaper__1nMakeShaperDrivenWrapper');
var org_jetbrains_skia_shaper_Shaper__1nMakeShapeThenWrap = Module['org_jetbrains_skia_shaper_Shaper__1nMakeShapeThenWrap'] = createExportWrapper('org_jetbrains_skia_shaper_Shaper__1nMakeShapeThenWrap');
var org_jetbrains_skia_shaper_Shaper__1nMakeShapeDontWrapOrReorder = Module['org_jetbrains_skia_shaper_Shaper__1nMakeShapeDontWrapOrReorder'] = createExportWrapper('org_jetbrains_skia_shaper_Shaper__1nMakeShapeDontWrapOrReorder');
var org_jetbrains_skia_shaper_Shaper__1nMakeCoreText = Module['org_jetbrains_skia_shaper_Shaper__1nMakeCoreText'] = createExportWrapper('org_jetbrains_skia_shaper_Shaper__1nMakeCoreText');
var org_jetbrains_skia_shaper_Shaper__1nMake = Module['org_jetbrains_skia_shaper_Shaper__1nMake'] = createExportWrapper('org_jetbrains_skia_shaper_Shaper__1nMake');
var org_jetbrains_skia_shaper_Shaper__1nShapeBlob = Module['org_jetbrains_skia_shaper_Shaper__1nShapeBlob'] = createExportWrapper('org_jetbrains_skia_shaper_Shaper__1nShapeBlob');
var org_jetbrains_skia_shaper_Shaper__1nShapeLine = Module['org_jetbrains_skia_shaper_Shaper__1nShapeLine'] = createExportWrapper('org_jetbrains_skia_shaper_Shaper__1nShapeLine');
var org_jetbrains_skia_shaper_Shaper__1nShape = Module['org_jetbrains_skia_shaper_Shaper__1nShape'] = createExportWrapper('org_jetbrains_skia_shaper_Shaper__1nShape');
var org_jetbrains_skia_shaper_Shaper_RunIterator_1nGetFinalizer = Module['org_jetbrains_skia_shaper_Shaper_RunIterator_1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_shaper_Shaper_RunIterator_1nGetFinalizer');
var org_jetbrains_skia_shaper_Shaper_RunIterator_1nCreateRunIterator = Module['org_jetbrains_skia_shaper_Shaper_RunIterator_1nCreateRunIterator'] = createExportWrapper('org_jetbrains_skia_shaper_Shaper_RunIterator_1nCreateRunIterator');
var org_jetbrains_skia_shaper_Shaper_RunIterator_1nInitRunIterator = Module['org_jetbrains_skia_shaper_Shaper_RunIterator_1nInitRunIterator'] = createExportWrapper('org_jetbrains_skia_shaper_Shaper_RunIterator_1nInitRunIterator');
var org_jetbrains_skia_shaper_Shaper_RunHandler_1nGetFinalizer = Module['org_jetbrains_skia_shaper_Shaper_RunHandler_1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_shaper_Shaper_RunHandler_1nGetFinalizer');
var org_jetbrains_skia_shaper_Shaper_RunHandler_1nGetRunInfo = Module['org_jetbrains_skia_shaper_Shaper_RunHandler_1nGetRunInfo'] = createExportWrapper('org_jetbrains_skia_shaper_Shaper_RunHandler_1nGetRunInfo');
var org_jetbrains_skia_shaper_Shaper_RunHandler_1nGetGlyphs = Module['org_jetbrains_skia_shaper_Shaper_RunHandler_1nGetGlyphs'] = createExportWrapper('org_jetbrains_skia_shaper_Shaper_RunHandler_1nGetGlyphs');
var org_jetbrains_skia_shaper_Shaper_RunHandler_1nGetPositions = Module['org_jetbrains_skia_shaper_Shaper_RunHandler_1nGetPositions'] = createExportWrapper('org_jetbrains_skia_shaper_Shaper_RunHandler_1nGetPositions');
var org_jetbrains_skia_shaper_Shaper_RunHandler_1nGetClusters = Module['org_jetbrains_skia_shaper_Shaper_RunHandler_1nGetClusters'] = createExportWrapper('org_jetbrains_skia_shaper_Shaper_RunHandler_1nGetClusters');
var org_jetbrains_skia_shaper_Shaper_RunHandler_1nSetOffset = Module['org_jetbrains_skia_shaper_Shaper_RunHandler_1nSetOffset'] = createExportWrapper('org_jetbrains_skia_shaper_Shaper_RunHandler_1nSetOffset');
var org_jetbrains_skia_shaper_Shaper_RunHandler_1nCreate = Module['org_jetbrains_skia_shaper_Shaper_RunHandler_1nCreate'] = createExportWrapper('org_jetbrains_skia_shaper_Shaper_RunHandler_1nCreate');
var org_jetbrains_skia_shaper_Shaper_RunHandler_1nInit = Module['org_jetbrains_skia_shaper_Shaper_RunHandler_1nInit'] = createExportWrapper('org_jetbrains_skia_shaper_Shaper_RunHandler_1nInit');
var org_jetbrains_skia_shaper_HbIcuScriptRunIterator__1nMake = Module['org_jetbrains_skia_shaper_HbIcuScriptRunIterator__1nMake'] = createExportWrapper('org_jetbrains_skia_shaper_HbIcuScriptRunIterator__1nMake');
var org_jetbrains_skia_shaper_HbIcuScriptRunIterator__1nGetCurrentScriptTag = Module['org_jetbrains_skia_shaper_HbIcuScriptRunIterator__1nGetCurrentScriptTag'] = createExportWrapper('org_jetbrains_skia_shaper_HbIcuScriptRunIterator__1nGetCurrentScriptTag');
var org_jetbrains_skia_shaper_TextBlobBuilderRunHandler__1nGetFinalizer = Module['org_jetbrains_skia_shaper_TextBlobBuilderRunHandler__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_shaper_TextBlobBuilderRunHandler__1nGetFinalizer');
var org_jetbrains_skia_shaper_TextBlobBuilderRunHandler__1nMake = Module['org_jetbrains_skia_shaper_TextBlobBuilderRunHandler__1nMake'] = createExportWrapper('org_jetbrains_skia_shaper_TextBlobBuilderRunHandler__1nMake');
var org_jetbrains_skia_shaper_TextBlobBuilderRunHandler__1nMakeBlob = Module['org_jetbrains_skia_shaper_TextBlobBuilderRunHandler__1nMakeBlob'] = createExportWrapper('org_jetbrains_skia_shaper_TextBlobBuilderRunHandler__1nMakeBlob');
var org_jetbrains_skia_shaper_IcuBidiRunIterator__1nMake = Module['org_jetbrains_skia_shaper_IcuBidiRunIterator__1nMake'] = createExportWrapper('org_jetbrains_skia_shaper_IcuBidiRunIterator__1nMake');
var org_jetbrains_skia_shaper_IcuBidiRunIterator__1nGetCurrentLevel = Module['org_jetbrains_skia_shaper_IcuBidiRunIterator__1nGetCurrentLevel'] = createExportWrapper('org_jetbrains_skia_shaper_IcuBidiRunIterator__1nGetCurrentLevel');
var org_jetbrains_skia_shaper_FontMgrRunIterator__1nMake = Module['org_jetbrains_skia_shaper_FontMgrRunIterator__1nMake'] = createExportWrapper('org_jetbrains_skia_shaper_FontMgrRunIterator__1nMake');
var org_jetbrains_skia_shaper_FontMgrRunIterator__1nGetCurrentFont = Module['org_jetbrains_skia_shaper_FontMgrRunIterator__1nGetCurrentFont'] = createExportWrapper('org_jetbrains_skia_shaper_FontMgrRunIterator__1nGetCurrentFont');
var org_jetbrains_skia_OutputWStream__1nGetFinalizer = Module['org_jetbrains_skia_OutputWStream__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_OutputWStream__1nGetFinalizer');
var org_jetbrains_skia_OutputWStream__1nMake = Module['org_jetbrains_skia_OutputWStream__1nMake'] = createExportWrapper('org_jetbrains_skia_OutputWStream__1nMake');
var org_jetbrains_skia_impl_Managed__invokeFinalizer = Module['org_jetbrains_skia_impl_Managed__invokeFinalizer'] = createExportWrapper('org_jetbrains_skia_impl_Managed__invokeFinalizer');
var org_jetbrains_skia_ColorType__1nIsAlwaysOpaque = Module['org_jetbrains_skia_ColorType__1nIsAlwaysOpaque'] = createExportWrapper('org_jetbrains_skia_ColorType__1nIsAlwaysOpaque');
var org_jetbrains_skia_Codec__1nGetFinalizer = Module['org_jetbrains_skia_Codec__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_Codec__1nGetFinalizer');
var org_jetbrains_skia_Codec__1nMakeFromData = Module['org_jetbrains_skia_Codec__1nMakeFromData'] = createExportWrapper('org_jetbrains_skia_Codec__1nMakeFromData');
var org_jetbrains_skia_Codec__1nGetImageInfo = Module['org_jetbrains_skia_Codec__1nGetImageInfo'] = createExportWrapper('org_jetbrains_skia_Codec__1nGetImageInfo');
var org_jetbrains_skia_Codec__1nGetSizeWidth = Module['org_jetbrains_skia_Codec__1nGetSizeWidth'] = createExportWrapper('org_jetbrains_skia_Codec__1nGetSizeWidth');
var org_jetbrains_skia_Codec__1nGetSizeHeight = Module['org_jetbrains_skia_Codec__1nGetSizeHeight'] = createExportWrapper('org_jetbrains_skia_Codec__1nGetSizeHeight');
var org_jetbrains_skia_Codec__1nGetEncodedOrigin = Module['org_jetbrains_skia_Codec__1nGetEncodedOrigin'] = createExportWrapper('org_jetbrains_skia_Codec__1nGetEncodedOrigin');
var org_jetbrains_skia_Codec__1nGetEncodedImageFormat = Module['org_jetbrains_skia_Codec__1nGetEncodedImageFormat'] = createExportWrapper('org_jetbrains_skia_Codec__1nGetEncodedImageFormat');
var org_jetbrains_skia_Codec__1nReadPixels = Module['org_jetbrains_skia_Codec__1nReadPixels'] = createExportWrapper('org_jetbrains_skia_Codec__1nReadPixels');
var org_jetbrains_skia_Codec__1nGetFrameCount = Module['org_jetbrains_skia_Codec__1nGetFrameCount'] = createExportWrapper('org_jetbrains_skia_Codec__1nGetFrameCount');
var org_jetbrains_skia_Codec__1nGetFrameInfo = Module['org_jetbrains_skia_Codec__1nGetFrameInfo'] = createExportWrapper('org_jetbrains_skia_Codec__1nGetFrameInfo');
var org_jetbrains_skia_Codec__1nGetFramesInfo = Module['org_jetbrains_skia_Codec__1nGetFramesInfo'] = createExportWrapper('org_jetbrains_skia_Codec__1nGetFramesInfo');
var org_jetbrains_skia_Codec__1nFramesInfo_Delete = Module['org_jetbrains_skia_Codec__1nFramesInfo_Delete'] = createExportWrapper('org_jetbrains_skia_Codec__1nFramesInfo_Delete');
var org_jetbrains_skia_Codec__1nFramesInfo_GetSize = Module['org_jetbrains_skia_Codec__1nFramesInfo_GetSize'] = createExportWrapper('org_jetbrains_skia_Codec__1nFramesInfo_GetSize');
var org_jetbrains_skia_Codec__1nFramesInfo_GetInfos = Module['org_jetbrains_skia_Codec__1nFramesInfo_GetInfos'] = createExportWrapper('org_jetbrains_skia_Codec__1nFramesInfo_GetInfos');
var org_jetbrains_skia_Codec__1nGetRepetitionCount = Module['org_jetbrains_skia_Codec__1nGetRepetitionCount'] = createExportWrapper('org_jetbrains_skia_Codec__1nGetRepetitionCount');
var org_jetbrains_skia_TextBlobBuilder__1nGetFinalizer = Module['org_jetbrains_skia_TextBlobBuilder__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_TextBlobBuilder__1nGetFinalizer');
var org_jetbrains_skia_TextBlobBuilder__1nMake = Module['org_jetbrains_skia_TextBlobBuilder__1nMake'] = createExportWrapper('org_jetbrains_skia_TextBlobBuilder__1nMake');
var org_jetbrains_skia_TextBlobBuilder__1nBuild = Module['org_jetbrains_skia_TextBlobBuilder__1nBuild'] = createExportWrapper('org_jetbrains_skia_TextBlobBuilder__1nBuild');
var org_jetbrains_skia_TextBlobBuilder__1nAppendRun = Module['org_jetbrains_skia_TextBlobBuilder__1nAppendRun'] = createExportWrapper('org_jetbrains_skia_TextBlobBuilder__1nAppendRun');
var org_jetbrains_skia_TextBlobBuilder__1nAppendRunPosH = Module['org_jetbrains_skia_TextBlobBuilder__1nAppendRunPosH'] = createExportWrapper('org_jetbrains_skia_TextBlobBuilder__1nAppendRunPosH');
var org_jetbrains_skia_TextBlobBuilder__1nAppendRunPos = Module['org_jetbrains_skia_TextBlobBuilder__1nAppendRunPos'] = createExportWrapper('org_jetbrains_skia_TextBlobBuilder__1nAppendRunPos');
var org_jetbrains_skia_TextBlobBuilder__1nAppendRunRSXform = Module['org_jetbrains_skia_TextBlobBuilder__1nAppendRunRSXform'] = createExportWrapper('org_jetbrains_skia_TextBlobBuilder__1nAppendRunRSXform');
var org_jetbrains_skia_Pixmap__1nGetFinalizer = Module['org_jetbrains_skia_Pixmap__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nGetFinalizer');
var org_jetbrains_skia_Pixmap__1nMakeNull = Module['org_jetbrains_skia_Pixmap__1nMakeNull'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nMakeNull');
var org_jetbrains_skia_Pixmap__1nMake = Module['org_jetbrains_skia_Pixmap__1nMake'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nMake');
var org_jetbrains_skia_Pixmap__1nReset = Module['org_jetbrains_skia_Pixmap__1nReset'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nReset');
var org_jetbrains_skia_Pixmap__1nResetWithInfo = Module['org_jetbrains_skia_Pixmap__1nResetWithInfo'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nResetWithInfo');
var org_jetbrains_skia_Pixmap__1nSetColorSpace = Module['org_jetbrains_skia_Pixmap__1nSetColorSpace'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nSetColorSpace');
var org_jetbrains_skia_Pixmap__1nExtractSubset = Module['org_jetbrains_skia_Pixmap__1nExtractSubset'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nExtractSubset');
var org_jetbrains_skia_Pixmap__1nGetInfo = Module['org_jetbrains_skia_Pixmap__1nGetInfo'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nGetInfo');
var org_jetbrains_skia_Pixmap__1nGetRowBytes = Module['org_jetbrains_skia_Pixmap__1nGetRowBytes'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nGetRowBytes');
var org_jetbrains_skia_Pixmap__1nGetAddr = Module['org_jetbrains_skia_Pixmap__1nGetAddr'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nGetAddr');
var org_jetbrains_skia_Pixmap__1nGetRowBytesAsPixels = Module['org_jetbrains_skia_Pixmap__1nGetRowBytesAsPixels'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nGetRowBytesAsPixels');
var org_jetbrains_skia_Pixmap__1nComputeByteSize = Module['org_jetbrains_skia_Pixmap__1nComputeByteSize'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nComputeByteSize');
var org_jetbrains_skia_Pixmap__1nComputeIsOpaque = Module['org_jetbrains_skia_Pixmap__1nComputeIsOpaque'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nComputeIsOpaque');
var org_jetbrains_skia_Pixmap__1nGetColor = Module['org_jetbrains_skia_Pixmap__1nGetColor'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nGetColor');
var org_jetbrains_skia_Pixmap__1nGetAlphaF = Module['org_jetbrains_skia_Pixmap__1nGetAlphaF'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nGetAlphaF');
var org_jetbrains_skia_Pixmap__1nGetAddrAt = Module['org_jetbrains_skia_Pixmap__1nGetAddrAt'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nGetAddrAt');
var org_jetbrains_skia_Pixmap__1nReadPixels = Module['org_jetbrains_skia_Pixmap__1nReadPixels'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nReadPixels');
var org_jetbrains_skia_Pixmap__1nReadPixelsFromPoint = Module['org_jetbrains_skia_Pixmap__1nReadPixelsFromPoint'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nReadPixelsFromPoint');
var org_jetbrains_skia_Pixmap__1nReadPixelsToPixmap = Module['org_jetbrains_skia_Pixmap__1nReadPixelsToPixmap'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nReadPixelsToPixmap');
var org_jetbrains_skia_Pixmap__1nReadPixelsToPixmapFromPoint = Module['org_jetbrains_skia_Pixmap__1nReadPixelsToPixmapFromPoint'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nReadPixelsToPixmapFromPoint');
var org_jetbrains_skia_Pixmap__1nScalePixels = Module['org_jetbrains_skia_Pixmap__1nScalePixels'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nScalePixels');
var org_jetbrains_skia_Pixmap__1nErase = Module['org_jetbrains_skia_Pixmap__1nErase'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nErase');
var org_jetbrains_skia_Pixmap__1nEraseSubset = Module['org_jetbrains_skia_Pixmap__1nEraseSubset'] = createExportWrapper('org_jetbrains_skia_Pixmap__1nEraseSubset');
var org_jetbrains_skia_MaskFilter__1nMakeBlur = Module['org_jetbrains_skia_MaskFilter__1nMakeBlur'] = createExportWrapper('org_jetbrains_skia_MaskFilter__1nMakeBlur');
var org_jetbrains_skia_MaskFilter__1nMakeShader = Module['org_jetbrains_skia_MaskFilter__1nMakeShader'] = createExportWrapper('org_jetbrains_skia_MaskFilter__1nMakeShader');
var org_jetbrains_skia_MaskFilter__1nMakeTable = Module['org_jetbrains_skia_MaskFilter__1nMakeTable'] = createExportWrapper('org_jetbrains_skia_MaskFilter__1nMakeTable');
var org_jetbrains_skia_MaskFilter__1nMakeGamma = Module['org_jetbrains_skia_MaskFilter__1nMakeGamma'] = createExportWrapper('org_jetbrains_skia_MaskFilter__1nMakeGamma');
var org_jetbrains_skia_MaskFilter__1nMakeClip = Module['org_jetbrains_skia_MaskFilter__1nMakeClip'] = createExportWrapper('org_jetbrains_skia_MaskFilter__1nMakeClip');
var org_jetbrains_skia_impl_RefCnt__getFinalizer = Module['org_jetbrains_skia_impl_RefCnt__getFinalizer'] = createExportWrapper('org_jetbrains_skia_impl_RefCnt__getFinalizer');
var org_jetbrains_skia_impl_RefCnt__getRefCount = Module['org_jetbrains_skia_impl_RefCnt__getRefCount'] = createExportWrapper('org_jetbrains_skia_impl_RefCnt__getRefCount');
var org_jetbrains_skia_RuntimeEffect__1nMakeShader = Module['org_jetbrains_skia_RuntimeEffect__1nMakeShader'] = createExportWrapper('org_jetbrains_skia_RuntimeEffect__1nMakeShader');
var org_jetbrains_skia_RuntimeEffect__1nMakeForShader = Module['org_jetbrains_skia_RuntimeEffect__1nMakeForShader'] = createExportWrapper('org_jetbrains_skia_RuntimeEffect__1nMakeForShader');
var org_jetbrains_skia_RuntimeEffect__1nMakeForColorFilter = Module['org_jetbrains_skia_RuntimeEffect__1nMakeForColorFilter'] = createExportWrapper('org_jetbrains_skia_RuntimeEffect__1nMakeForColorFilter');
var org_jetbrains_skia_RuntimeEffect__1Result_nGetPtr = Module['org_jetbrains_skia_RuntimeEffect__1Result_nGetPtr'] = createExportWrapper('org_jetbrains_skia_RuntimeEffect__1Result_nGetPtr');
var org_jetbrains_skia_RuntimeEffect__1Result_nGetError = Module['org_jetbrains_skia_RuntimeEffect__1Result_nGetError'] = createExportWrapper('org_jetbrains_skia_RuntimeEffect__1Result_nGetError');
var org_jetbrains_skia_RuntimeEffect__1Result_nDestroy = Module['org_jetbrains_skia_RuntimeEffect__1Result_nDestroy'] = createExportWrapper('org_jetbrains_skia_RuntimeEffect__1Result_nDestroy');
var org_jetbrains_skia_PaintFilterCanvas__1nInit = Module['org_jetbrains_skia_PaintFilterCanvas__1nInit'] = createExportWrapper('org_jetbrains_skia_PaintFilterCanvas__1nInit');
var org_jetbrains_skia_PaintFilterCanvas__1nMake = Module['org_jetbrains_skia_PaintFilterCanvas__1nMake'] = createExportWrapper('org_jetbrains_skia_PaintFilterCanvas__1nMake');
var org_jetbrains_skia_PaintFilterCanvas__1nGetOnFilterPaint = Module['org_jetbrains_skia_PaintFilterCanvas__1nGetOnFilterPaint'] = createExportWrapper('org_jetbrains_skia_PaintFilterCanvas__1nGetOnFilterPaint');
var org_jetbrains_skia_ColorSpace__1nGetFinalizer = Module['org_jetbrains_skia_ColorSpace__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_ColorSpace__1nGetFinalizer');
var org_jetbrains_skia_ColorSpace__1nMakeSRGB = Module['org_jetbrains_skia_ColorSpace__1nMakeSRGB'] = createExportWrapper('org_jetbrains_skia_ColorSpace__1nMakeSRGB');
var org_jetbrains_skia_ColorSpace__1nMakeSRGBLinear = Module['org_jetbrains_skia_ColorSpace__1nMakeSRGBLinear'] = createExportWrapper('org_jetbrains_skia_ColorSpace__1nMakeSRGBLinear');
var org_jetbrains_skia_ColorSpace__1nMakeDisplayP3 = Module['org_jetbrains_skia_ColorSpace__1nMakeDisplayP3'] = createExportWrapper('org_jetbrains_skia_ColorSpace__1nMakeDisplayP3');
var org_jetbrains_skia_ColorSpace__nConvert = Module['org_jetbrains_skia_ColorSpace__nConvert'] = createExportWrapper('org_jetbrains_skia_ColorSpace__nConvert');
var org_jetbrains_skia_ColorSpace__1nIsGammaCloseToSRGB = Module['org_jetbrains_skia_ColorSpace__1nIsGammaCloseToSRGB'] = createExportWrapper('org_jetbrains_skia_ColorSpace__1nIsGammaCloseToSRGB');
var org_jetbrains_skia_ColorSpace__1nIsGammaLinear = Module['org_jetbrains_skia_ColorSpace__1nIsGammaLinear'] = createExportWrapper('org_jetbrains_skia_ColorSpace__1nIsGammaLinear');
var org_jetbrains_skia_ColorSpace__1nIsSRGB = Module['org_jetbrains_skia_ColorSpace__1nIsSRGB'] = createExportWrapper('org_jetbrains_skia_ColorSpace__1nIsSRGB');
var org_jetbrains_skia_Font__1nGetFinalizer = Module['org_jetbrains_skia_Font__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_Font__1nGetFinalizer');
var org_jetbrains_skia_Font__1nMakeDefault = Module['org_jetbrains_skia_Font__1nMakeDefault'] = createExportWrapper('org_jetbrains_skia_Font__1nMakeDefault');
var org_jetbrains_skia_Font__1nMakeTypeface = Module['org_jetbrains_skia_Font__1nMakeTypeface'] = createExportWrapper('org_jetbrains_skia_Font__1nMakeTypeface');
var org_jetbrains_skia_Font__1nMakeTypefaceSize = Module['org_jetbrains_skia_Font__1nMakeTypefaceSize'] = createExportWrapper('org_jetbrains_skia_Font__1nMakeTypefaceSize');
var org_jetbrains_skia_Font__1nMakeTypefaceSizeScaleSkew = Module['org_jetbrains_skia_Font__1nMakeTypefaceSizeScaleSkew'] = createExportWrapper('org_jetbrains_skia_Font__1nMakeTypefaceSizeScaleSkew');
var org_jetbrains_skia_Font__1nMakeClone = Module['org_jetbrains_skia_Font__1nMakeClone'] = createExportWrapper('org_jetbrains_skia_Font__1nMakeClone');
var org_jetbrains_skia_Font__1nEquals = Module['org_jetbrains_skia_Font__1nEquals'] = createExportWrapper('org_jetbrains_skia_Font__1nEquals');
var org_jetbrains_skia_Font__1nIsAutoHintingForced = Module['org_jetbrains_skia_Font__1nIsAutoHintingForced'] = createExportWrapper('org_jetbrains_skia_Font__1nIsAutoHintingForced');
var org_jetbrains_skia_Font__1nAreBitmapsEmbedded = Module['org_jetbrains_skia_Font__1nAreBitmapsEmbedded'] = createExportWrapper('org_jetbrains_skia_Font__1nAreBitmapsEmbedded');
var org_jetbrains_skia_Font__1nIsSubpixel = Module['org_jetbrains_skia_Font__1nIsSubpixel'] = createExportWrapper('org_jetbrains_skia_Font__1nIsSubpixel');
var org_jetbrains_skia_Font__1nIsLinearMetrics = Module['org_jetbrains_skia_Font__1nIsLinearMetrics'] = createExportWrapper('org_jetbrains_skia_Font__1nIsLinearMetrics');
var org_jetbrains_skia_Font__1nIsEmboldened = Module['org_jetbrains_skia_Font__1nIsEmboldened'] = createExportWrapper('org_jetbrains_skia_Font__1nIsEmboldened');
var org_jetbrains_skia_Font__1nIsBaselineSnapped = Module['org_jetbrains_skia_Font__1nIsBaselineSnapped'] = createExportWrapper('org_jetbrains_skia_Font__1nIsBaselineSnapped');
var org_jetbrains_skia_Font__1nSetAutoHintingForced = Module['org_jetbrains_skia_Font__1nSetAutoHintingForced'] = createExportWrapper('org_jetbrains_skia_Font__1nSetAutoHintingForced');
var org_jetbrains_skia_Font__1nSetBitmapsEmbedded = Module['org_jetbrains_skia_Font__1nSetBitmapsEmbedded'] = createExportWrapper('org_jetbrains_skia_Font__1nSetBitmapsEmbedded');
var org_jetbrains_skia_Font__1nSetSubpixel = Module['org_jetbrains_skia_Font__1nSetSubpixel'] = createExportWrapper('org_jetbrains_skia_Font__1nSetSubpixel');
var org_jetbrains_skia_Font__1nSetLinearMetrics = Module['org_jetbrains_skia_Font__1nSetLinearMetrics'] = createExportWrapper('org_jetbrains_skia_Font__1nSetLinearMetrics');
var org_jetbrains_skia_Font__1nSetEmboldened = Module['org_jetbrains_skia_Font__1nSetEmboldened'] = createExportWrapper('org_jetbrains_skia_Font__1nSetEmboldened');
var org_jetbrains_skia_Font__1nSetBaselineSnapped = Module['org_jetbrains_skia_Font__1nSetBaselineSnapped'] = createExportWrapper('org_jetbrains_skia_Font__1nSetBaselineSnapped');
var org_jetbrains_skia_Font__1nGetEdging = Module['org_jetbrains_skia_Font__1nGetEdging'] = createExportWrapper('org_jetbrains_skia_Font__1nGetEdging');
var org_jetbrains_skia_Font__1nSetEdging = Module['org_jetbrains_skia_Font__1nSetEdging'] = createExportWrapper('org_jetbrains_skia_Font__1nSetEdging');
var org_jetbrains_skia_Font__1nGetHinting = Module['org_jetbrains_skia_Font__1nGetHinting'] = createExportWrapper('org_jetbrains_skia_Font__1nGetHinting');
var org_jetbrains_skia_Font__1nSetHinting = Module['org_jetbrains_skia_Font__1nSetHinting'] = createExportWrapper('org_jetbrains_skia_Font__1nSetHinting');
var org_jetbrains_skia_Font__1nGetTypeface = Module['org_jetbrains_skia_Font__1nGetTypeface'] = createExportWrapper('org_jetbrains_skia_Font__1nGetTypeface');
var org_jetbrains_skia_Font__1nGetSize = Module['org_jetbrains_skia_Font__1nGetSize'] = createExportWrapper('org_jetbrains_skia_Font__1nGetSize');
var org_jetbrains_skia_Font__1nGetScaleX = Module['org_jetbrains_skia_Font__1nGetScaleX'] = createExportWrapper('org_jetbrains_skia_Font__1nGetScaleX');
var org_jetbrains_skia_Font__1nGetSkewX = Module['org_jetbrains_skia_Font__1nGetSkewX'] = createExportWrapper('org_jetbrains_skia_Font__1nGetSkewX');
var org_jetbrains_skia_Font__1nSetTypeface = Module['org_jetbrains_skia_Font__1nSetTypeface'] = createExportWrapper('org_jetbrains_skia_Font__1nSetTypeface');
var org_jetbrains_skia_Font__1nSetSize = Module['org_jetbrains_skia_Font__1nSetSize'] = createExportWrapper('org_jetbrains_skia_Font__1nSetSize');
var org_jetbrains_skia_Font__1nSetScaleX = Module['org_jetbrains_skia_Font__1nSetScaleX'] = createExportWrapper('org_jetbrains_skia_Font__1nSetScaleX');
var org_jetbrains_skia_Font__1nSetSkewX = Module['org_jetbrains_skia_Font__1nSetSkewX'] = createExportWrapper('org_jetbrains_skia_Font__1nSetSkewX');
var org_jetbrains_skia_Font__1nGetUTF32Glyphs = Module['org_jetbrains_skia_Font__1nGetUTF32Glyphs'] = createExportWrapper('org_jetbrains_skia_Font__1nGetUTF32Glyphs');
var org_jetbrains_skia_Font__1nGetUTF32Glyph = Module['org_jetbrains_skia_Font__1nGetUTF32Glyph'] = createExportWrapper('org_jetbrains_skia_Font__1nGetUTF32Glyph');
var org_jetbrains_skia_Font__1nGetStringGlyphsCount = Module['org_jetbrains_skia_Font__1nGetStringGlyphsCount'] = createExportWrapper('org_jetbrains_skia_Font__1nGetStringGlyphsCount');
var org_jetbrains_skia_Font__1nMeasureText = Module['org_jetbrains_skia_Font__1nMeasureText'] = createExportWrapper('org_jetbrains_skia_Font__1nMeasureText');
var org_jetbrains_skia_Font__1nMeasureTextWidth = Module['org_jetbrains_skia_Font__1nMeasureTextWidth'] = createExportWrapper('org_jetbrains_skia_Font__1nMeasureTextWidth');
var org_jetbrains_skia_Font__1nGetWidths = Module['org_jetbrains_skia_Font__1nGetWidths'] = createExportWrapper('org_jetbrains_skia_Font__1nGetWidths');
var org_jetbrains_skia_Font__1nGetBounds = Module['org_jetbrains_skia_Font__1nGetBounds'] = createExportWrapper('org_jetbrains_skia_Font__1nGetBounds');
var org_jetbrains_skia_Font__1nGetPositions = Module['org_jetbrains_skia_Font__1nGetPositions'] = createExportWrapper('org_jetbrains_skia_Font__1nGetPositions');
var org_jetbrains_skia_Font__1nGetXPositions = Module['org_jetbrains_skia_Font__1nGetXPositions'] = createExportWrapper('org_jetbrains_skia_Font__1nGetXPositions');
var org_jetbrains_skia_Font__1nGetPath = Module['org_jetbrains_skia_Font__1nGetPath'] = createExportWrapper('org_jetbrains_skia_Font__1nGetPath');
var org_jetbrains_skia_Font__1nGetPaths = Module['org_jetbrains_skia_Font__1nGetPaths'] = createExportWrapper('org_jetbrains_skia_Font__1nGetPaths');
var org_jetbrains_skia_Font__1nGetMetrics = Module['org_jetbrains_skia_Font__1nGetMetrics'] = createExportWrapper('org_jetbrains_skia_Font__1nGetMetrics');
var org_jetbrains_skia_Font__1nGetSpacing = Module['org_jetbrains_skia_Font__1nGetSpacing'] = createExportWrapper('org_jetbrains_skia_Font__1nGetSpacing');
var org_jetbrains_skia_sksg_InvalidationController_nGetFinalizer = Module['org_jetbrains_skia_sksg_InvalidationController_nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_sksg_InvalidationController_nGetFinalizer');
var org_jetbrains_skia_sksg_InvalidationController_nMake = Module['org_jetbrains_skia_sksg_InvalidationController_nMake'] = createExportWrapper('org_jetbrains_skia_sksg_InvalidationController_nMake');
var org_jetbrains_skia_sksg_InvalidationController_nInvalidate = Module['org_jetbrains_skia_sksg_InvalidationController_nInvalidate'] = createExportWrapper('org_jetbrains_skia_sksg_InvalidationController_nInvalidate');
var org_jetbrains_skia_sksg_InvalidationController_nGetBounds = Module['org_jetbrains_skia_sksg_InvalidationController_nGetBounds'] = createExportWrapper('org_jetbrains_skia_sksg_InvalidationController_nGetBounds');
var org_jetbrains_skia_sksg_InvalidationController_nReset = Module['org_jetbrains_skia_sksg_InvalidationController_nReset'] = createExportWrapper('org_jetbrains_skia_sksg_InvalidationController_nReset');
var org_jetbrains_skia_TextBlob__1nGetFinalizer = Module['org_jetbrains_skia_TextBlob__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_TextBlob__1nGetFinalizer');
var org_jetbrains_skia_TextBlob__1nBounds = Module['org_jetbrains_skia_TextBlob__1nBounds'] = createExportWrapper('org_jetbrains_skia_TextBlob__1nBounds');
var org_jetbrains_skia_TextBlob__1nGetUniqueId = Module['org_jetbrains_skia_TextBlob__1nGetUniqueId'] = createExportWrapper('org_jetbrains_skia_TextBlob__1nGetUniqueId');
var org_jetbrains_skia_TextBlob__1nGetInterceptsLength = Module['org_jetbrains_skia_TextBlob__1nGetInterceptsLength'] = createExportWrapper('org_jetbrains_skia_TextBlob__1nGetInterceptsLength');
var org_jetbrains_skia_TextBlob__1nGetIntercepts = Module['org_jetbrains_skia_TextBlob__1nGetIntercepts'] = createExportWrapper('org_jetbrains_skia_TextBlob__1nGetIntercepts');
var org_jetbrains_skia_TextBlob__1nMakeFromPosH = Module['org_jetbrains_skia_TextBlob__1nMakeFromPosH'] = createExportWrapper('org_jetbrains_skia_TextBlob__1nMakeFromPosH');
var org_jetbrains_skia_TextBlob__1nMakeFromPos = Module['org_jetbrains_skia_TextBlob__1nMakeFromPos'] = createExportWrapper('org_jetbrains_skia_TextBlob__1nMakeFromPos');
var org_jetbrains_skia_TextBlob__1nMakeFromRSXform = Module['org_jetbrains_skia_TextBlob__1nMakeFromRSXform'] = createExportWrapper('org_jetbrains_skia_TextBlob__1nMakeFromRSXform');
var org_jetbrains_skia_TextBlob__1nSerializeToData = Module['org_jetbrains_skia_TextBlob__1nSerializeToData'] = createExportWrapper('org_jetbrains_skia_TextBlob__1nSerializeToData');
var org_jetbrains_skia_TextBlob__1nMakeFromData = Module['org_jetbrains_skia_TextBlob__1nMakeFromData'] = createExportWrapper('org_jetbrains_skia_TextBlob__1nMakeFromData');
var org_jetbrains_skia_TextBlob__1nGetGlyphsLength = Module['org_jetbrains_skia_TextBlob__1nGetGlyphsLength'] = createExportWrapper('org_jetbrains_skia_TextBlob__1nGetGlyphsLength');
var org_jetbrains_skia_TextBlob__1nGetGlyphs = Module['org_jetbrains_skia_TextBlob__1nGetGlyphs'] = createExportWrapper('org_jetbrains_skia_TextBlob__1nGetGlyphs');
var org_jetbrains_skia_TextBlob__1nGetPositionsLength = Module['org_jetbrains_skia_TextBlob__1nGetPositionsLength'] = createExportWrapper('org_jetbrains_skia_TextBlob__1nGetPositionsLength');
var org_jetbrains_skia_TextBlob__1nGetPositions = Module['org_jetbrains_skia_TextBlob__1nGetPositions'] = createExportWrapper('org_jetbrains_skia_TextBlob__1nGetPositions');
var org_jetbrains_skia_TextBlob__1nGetClustersLength = Module['org_jetbrains_skia_TextBlob__1nGetClustersLength'] = createExportWrapper('org_jetbrains_skia_TextBlob__1nGetClustersLength');
var org_jetbrains_skia_TextBlob__1nGetClusters = Module['org_jetbrains_skia_TextBlob__1nGetClusters'] = createExportWrapper('org_jetbrains_skia_TextBlob__1nGetClusters');
var org_jetbrains_skia_TextBlob__1nGetTightBounds = Module['org_jetbrains_skia_TextBlob__1nGetTightBounds'] = createExportWrapper('org_jetbrains_skia_TextBlob__1nGetTightBounds');
var org_jetbrains_skia_TextBlob__1nGetBlockBounds = Module['org_jetbrains_skia_TextBlob__1nGetBlockBounds'] = createExportWrapper('org_jetbrains_skia_TextBlob__1nGetBlockBounds');
var org_jetbrains_skia_TextBlob__1nGetFirstBaseline = Module['org_jetbrains_skia_TextBlob__1nGetFirstBaseline'] = createExportWrapper('org_jetbrains_skia_TextBlob__1nGetFirstBaseline');
var org_jetbrains_skia_TextBlob__1nGetLastBaseline = Module['org_jetbrains_skia_TextBlob__1nGetLastBaseline'] = createExportWrapper('org_jetbrains_skia_TextBlob__1nGetLastBaseline');
var org_jetbrains_skia_TextBlob_Iter__1nCreate = Module['org_jetbrains_skia_TextBlob_Iter__1nCreate'] = createExportWrapper('org_jetbrains_skia_TextBlob_Iter__1nCreate');
var org_jetbrains_skia_TextBlob_Iter__1nGetFinalizer = Module['org_jetbrains_skia_TextBlob_Iter__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_TextBlob_Iter__1nGetFinalizer');
var org_jetbrains_skia_TextBlob_Iter__1nFetch = Module['org_jetbrains_skia_TextBlob_Iter__1nFetch'] = createExportWrapper('org_jetbrains_skia_TextBlob_Iter__1nFetch');
var org_jetbrains_skia_TextBlob_Iter__1nHasNext = Module['org_jetbrains_skia_TextBlob_Iter__1nHasNext'] = createExportWrapper('org_jetbrains_skia_TextBlob_Iter__1nHasNext');
var org_jetbrains_skia_TextBlob_Iter__1nGetTypeface = Module['org_jetbrains_skia_TextBlob_Iter__1nGetTypeface'] = createExportWrapper('org_jetbrains_skia_TextBlob_Iter__1nGetTypeface');
var org_jetbrains_skia_TextBlob_Iter__1nGetGlyphCount = Module['org_jetbrains_skia_TextBlob_Iter__1nGetGlyphCount'] = createExportWrapper('org_jetbrains_skia_TextBlob_Iter__1nGetGlyphCount');
var org_jetbrains_skia_TextBlob_Iter__1nGetGlyphs = Module['org_jetbrains_skia_TextBlob_Iter__1nGetGlyphs'] = createExportWrapper('org_jetbrains_skia_TextBlob_Iter__1nGetGlyphs');
var org_jetbrains_skia_Region__1nMake = Module['org_jetbrains_skia_Region__1nMake'] = createExportWrapper('org_jetbrains_skia_Region__1nMake');
var org_jetbrains_skia_Region__1nGetFinalizer = Module['org_jetbrains_skia_Region__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_Region__1nGetFinalizer');
var org_jetbrains_skia_Region__1nSet = Module['org_jetbrains_skia_Region__1nSet'] = createExportWrapper('org_jetbrains_skia_Region__1nSet');
var org_jetbrains_skia_Region__1nIsEmpty = Module['org_jetbrains_skia_Region__1nIsEmpty'] = createExportWrapper('org_jetbrains_skia_Region__1nIsEmpty');
var org_jetbrains_skia_Region__1nIsRect = Module['org_jetbrains_skia_Region__1nIsRect'] = createExportWrapper('org_jetbrains_skia_Region__1nIsRect');
var org_jetbrains_skia_Region__1nIsComplex = Module['org_jetbrains_skia_Region__1nIsComplex'] = createExportWrapper('org_jetbrains_skia_Region__1nIsComplex');
var org_jetbrains_skia_Region__1nGetBounds = Module['org_jetbrains_skia_Region__1nGetBounds'] = createExportWrapper('org_jetbrains_skia_Region__1nGetBounds');
var org_jetbrains_skia_Region__1nComputeRegionComplexity = Module['org_jetbrains_skia_Region__1nComputeRegionComplexity'] = createExportWrapper('org_jetbrains_skia_Region__1nComputeRegionComplexity');
var org_jetbrains_skia_Region__1nGetBoundaryPath = Module['org_jetbrains_skia_Region__1nGetBoundaryPath'] = createExportWrapper('org_jetbrains_skia_Region__1nGetBoundaryPath');
var org_jetbrains_skia_Region__1nSetEmpty = Module['org_jetbrains_skia_Region__1nSetEmpty'] = createExportWrapper('org_jetbrains_skia_Region__1nSetEmpty');
var org_jetbrains_skia_Region__1nSetRect = Module['org_jetbrains_skia_Region__1nSetRect'] = createExportWrapper('org_jetbrains_skia_Region__1nSetRect');
var org_jetbrains_skia_Region__1nSetRects = Module['org_jetbrains_skia_Region__1nSetRects'] = createExportWrapper('org_jetbrains_skia_Region__1nSetRects');
var org_jetbrains_skia_Region__1nSetRegion = Module['org_jetbrains_skia_Region__1nSetRegion'] = createExportWrapper('org_jetbrains_skia_Region__1nSetRegion');
var org_jetbrains_skia_Region__1nSetPath = Module['org_jetbrains_skia_Region__1nSetPath'] = createExportWrapper('org_jetbrains_skia_Region__1nSetPath');
var org_jetbrains_skia_Region__1nIntersectsIRect = Module['org_jetbrains_skia_Region__1nIntersectsIRect'] = createExportWrapper('org_jetbrains_skia_Region__1nIntersectsIRect');
var org_jetbrains_skia_Region__1nIntersectsRegion = Module['org_jetbrains_skia_Region__1nIntersectsRegion'] = createExportWrapper('org_jetbrains_skia_Region__1nIntersectsRegion');
var org_jetbrains_skia_Region__1nContainsIPoint = Module['org_jetbrains_skia_Region__1nContainsIPoint'] = createExportWrapper('org_jetbrains_skia_Region__1nContainsIPoint');
var org_jetbrains_skia_Region__1nContainsIRect = Module['org_jetbrains_skia_Region__1nContainsIRect'] = createExportWrapper('org_jetbrains_skia_Region__1nContainsIRect');
var org_jetbrains_skia_Region__1nContainsRegion = Module['org_jetbrains_skia_Region__1nContainsRegion'] = createExportWrapper('org_jetbrains_skia_Region__1nContainsRegion');
var org_jetbrains_skia_Region__1nQuickContains = Module['org_jetbrains_skia_Region__1nQuickContains'] = createExportWrapper('org_jetbrains_skia_Region__1nQuickContains');
var org_jetbrains_skia_Region__1nQuickRejectIRect = Module['org_jetbrains_skia_Region__1nQuickRejectIRect'] = createExportWrapper('org_jetbrains_skia_Region__1nQuickRejectIRect');
var org_jetbrains_skia_Region__1nQuickRejectRegion = Module['org_jetbrains_skia_Region__1nQuickRejectRegion'] = createExportWrapper('org_jetbrains_skia_Region__1nQuickRejectRegion');
var org_jetbrains_skia_Region__1nTranslate = Module['org_jetbrains_skia_Region__1nTranslate'] = createExportWrapper('org_jetbrains_skia_Region__1nTranslate');
var org_jetbrains_skia_Region__1nOpIRect = Module['org_jetbrains_skia_Region__1nOpIRect'] = createExportWrapper('org_jetbrains_skia_Region__1nOpIRect');
var org_jetbrains_skia_Region__1nOpRegion = Module['org_jetbrains_skia_Region__1nOpRegion'] = createExportWrapper('org_jetbrains_skia_Region__1nOpRegion');
var org_jetbrains_skia_Region__1nOpIRectRegion = Module['org_jetbrains_skia_Region__1nOpIRectRegion'] = createExportWrapper('org_jetbrains_skia_Region__1nOpIRectRegion');
var org_jetbrains_skia_Region__1nOpRegionIRect = Module['org_jetbrains_skia_Region__1nOpRegionIRect'] = createExportWrapper('org_jetbrains_skia_Region__1nOpRegionIRect');
var org_jetbrains_skia_Region__1nOpRegionRegion = Module['org_jetbrains_skia_Region__1nOpRegionRegion'] = createExportWrapper('org_jetbrains_skia_Region__1nOpRegionRegion');
var org_jetbrains_skia_GraphicsKt__1nGetFontCacheLimit = Module['org_jetbrains_skia_GraphicsKt__1nGetFontCacheLimit'] = createExportWrapper('org_jetbrains_skia_GraphicsKt__1nGetFontCacheLimit');
var org_jetbrains_skia_GraphicsKt__1nSetFontCacheLimit = Module['org_jetbrains_skia_GraphicsKt__1nSetFontCacheLimit'] = createExportWrapper('org_jetbrains_skia_GraphicsKt__1nSetFontCacheLimit');
var org_jetbrains_skia_GraphicsKt__1nGetFontCacheUsed = Module['org_jetbrains_skia_GraphicsKt__1nGetFontCacheUsed'] = createExportWrapper('org_jetbrains_skia_GraphicsKt__1nGetFontCacheUsed');
var org_jetbrains_skia_GraphicsKt__1nGetFontCacheCountLimit = Module['org_jetbrains_skia_GraphicsKt__1nGetFontCacheCountLimit'] = createExportWrapper('org_jetbrains_skia_GraphicsKt__1nGetFontCacheCountLimit');
var org_jetbrains_skia_GraphicsKt__1nSetFontCacheCountLimit = Module['org_jetbrains_skia_GraphicsKt__1nSetFontCacheCountLimit'] = createExportWrapper('org_jetbrains_skia_GraphicsKt__1nSetFontCacheCountLimit');
var org_jetbrains_skia_GraphicsKt__1nGetFontCacheCountUsed = Module['org_jetbrains_skia_GraphicsKt__1nGetFontCacheCountUsed'] = createExportWrapper('org_jetbrains_skia_GraphicsKt__1nGetFontCacheCountUsed');
var org_jetbrains_skia_GraphicsKt__1nGetResourceCacheTotalByteLimit = Module['org_jetbrains_skia_GraphicsKt__1nGetResourceCacheTotalByteLimit'] = createExportWrapper('org_jetbrains_skia_GraphicsKt__1nGetResourceCacheTotalByteLimit');
var org_jetbrains_skia_GraphicsKt__1nSetResourceCacheTotalByteLimit = Module['org_jetbrains_skia_GraphicsKt__1nSetResourceCacheTotalByteLimit'] = createExportWrapper('org_jetbrains_skia_GraphicsKt__1nSetResourceCacheTotalByteLimit');
var org_jetbrains_skia_GraphicsKt__1nGetResourceCacheSingleAllocationByteLimit = Module['org_jetbrains_skia_GraphicsKt__1nGetResourceCacheSingleAllocationByteLimit'] = createExportWrapper('org_jetbrains_skia_GraphicsKt__1nGetResourceCacheSingleAllocationByteLimit');
var org_jetbrains_skia_GraphicsKt__1nSetResourceCacheSingleAllocationByteLimit = Module['org_jetbrains_skia_GraphicsKt__1nSetResourceCacheSingleAllocationByteLimit'] = createExportWrapper('org_jetbrains_skia_GraphicsKt__1nSetResourceCacheSingleAllocationByteLimit');
var org_jetbrains_skia_GraphicsKt__1nGetResourceCacheTotalBytesUsed = Module['org_jetbrains_skia_GraphicsKt__1nGetResourceCacheTotalBytesUsed'] = createExportWrapper('org_jetbrains_skia_GraphicsKt__1nGetResourceCacheTotalBytesUsed');
var org_jetbrains_skia_GraphicsKt__1nPurgeFontCache = Module['org_jetbrains_skia_GraphicsKt__1nPurgeFontCache'] = createExportWrapper('org_jetbrains_skia_GraphicsKt__1nPurgeFontCache');
var org_jetbrains_skia_GraphicsKt__1nPurgeResourceCache = Module['org_jetbrains_skia_GraphicsKt__1nPurgeResourceCache'] = createExportWrapper('org_jetbrains_skia_GraphicsKt__1nPurgeResourceCache');
var org_jetbrains_skia_GraphicsKt__1nPurgeAllCaches = Module['org_jetbrains_skia_GraphicsKt__1nPurgeAllCaches'] = createExportWrapper('org_jetbrains_skia_GraphicsKt__1nPurgeAllCaches');
var org_jetbrains_skia_Canvas__1nGetFinalizer = Module['org_jetbrains_skia_Canvas__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_Canvas__1nGetFinalizer');
var org_jetbrains_skia_Canvas__1nMakeFromBitmap = Module['org_jetbrains_skia_Canvas__1nMakeFromBitmap'] = createExportWrapper('org_jetbrains_skia_Canvas__1nMakeFromBitmap');
var org_jetbrains_skia_Canvas__1nDrawPoint = Module['org_jetbrains_skia_Canvas__1nDrawPoint'] = createExportWrapper('org_jetbrains_skia_Canvas__1nDrawPoint');
var org_jetbrains_skia_Canvas__1nDrawPoints = Module['org_jetbrains_skia_Canvas__1nDrawPoints'] = createExportWrapper('org_jetbrains_skia_Canvas__1nDrawPoints');
var org_jetbrains_skia_Canvas__1nDrawLine = Module['org_jetbrains_skia_Canvas__1nDrawLine'] = createExportWrapper('org_jetbrains_skia_Canvas__1nDrawLine');
var org_jetbrains_skia_Canvas__1nDrawArc = Module['org_jetbrains_skia_Canvas__1nDrawArc'] = createExportWrapper('org_jetbrains_skia_Canvas__1nDrawArc');
var org_jetbrains_skia_Canvas__1nDrawRect = Module['org_jetbrains_skia_Canvas__1nDrawRect'] = createExportWrapper('org_jetbrains_skia_Canvas__1nDrawRect');
var org_jetbrains_skia_Canvas__1nDrawOval = Module['org_jetbrains_skia_Canvas__1nDrawOval'] = createExportWrapper('org_jetbrains_skia_Canvas__1nDrawOval');
var org_jetbrains_skia_Canvas__1nDrawRRect = Module['org_jetbrains_skia_Canvas__1nDrawRRect'] = createExportWrapper('org_jetbrains_skia_Canvas__1nDrawRRect');
var org_jetbrains_skia_Canvas__1nDrawDRRect = Module['org_jetbrains_skia_Canvas__1nDrawDRRect'] = createExportWrapper('org_jetbrains_skia_Canvas__1nDrawDRRect');
var org_jetbrains_skia_Canvas__1nDrawPath = Module['org_jetbrains_skia_Canvas__1nDrawPath'] = createExportWrapper('org_jetbrains_skia_Canvas__1nDrawPath');
var org_jetbrains_skia_Canvas__1nDrawImageRect = Module['org_jetbrains_skia_Canvas__1nDrawImageRect'] = createExportWrapper('org_jetbrains_skia_Canvas__1nDrawImageRect');
var org_jetbrains_skia_Canvas__1nDrawImageNine = Module['org_jetbrains_skia_Canvas__1nDrawImageNine'] = createExportWrapper('org_jetbrains_skia_Canvas__1nDrawImageNine');
var org_jetbrains_skia_Canvas__1nDrawRegion = Module['org_jetbrains_skia_Canvas__1nDrawRegion'] = createExportWrapper('org_jetbrains_skia_Canvas__1nDrawRegion');
var org_jetbrains_skia_Canvas__1nDrawString = Module['org_jetbrains_skia_Canvas__1nDrawString'] = createExportWrapper('org_jetbrains_skia_Canvas__1nDrawString');
var org_jetbrains_skia_Canvas__1nDrawTextBlob = Module['org_jetbrains_skia_Canvas__1nDrawTextBlob'] = createExportWrapper('org_jetbrains_skia_Canvas__1nDrawTextBlob');
var org_jetbrains_skia_Canvas__1nDrawPicture = Module['org_jetbrains_skia_Canvas__1nDrawPicture'] = createExportWrapper('org_jetbrains_skia_Canvas__1nDrawPicture');
var org_jetbrains_skia_Canvas__1nDrawVertices = Module['org_jetbrains_skia_Canvas__1nDrawVertices'] = createExportWrapper('org_jetbrains_skia_Canvas__1nDrawVertices');
var org_jetbrains_skia_Canvas__1nDrawPatch = Module['org_jetbrains_skia_Canvas__1nDrawPatch'] = createExportWrapper('org_jetbrains_skia_Canvas__1nDrawPatch');
var org_jetbrains_skia_Canvas__1nDrawDrawable = Module['org_jetbrains_skia_Canvas__1nDrawDrawable'] = createExportWrapper('org_jetbrains_skia_Canvas__1nDrawDrawable');
var org_jetbrains_skia_Canvas__1nClear = Module['org_jetbrains_skia_Canvas__1nClear'] = createExportWrapper('org_jetbrains_skia_Canvas__1nClear');
var org_jetbrains_skia_Canvas__1nDrawPaint = Module['org_jetbrains_skia_Canvas__1nDrawPaint'] = createExportWrapper('org_jetbrains_skia_Canvas__1nDrawPaint');
var org_jetbrains_skia_Canvas__1nSetMatrix = Module['org_jetbrains_skia_Canvas__1nSetMatrix'] = createExportWrapper('org_jetbrains_skia_Canvas__1nSetMatrix');
var org_jetbrains_skia_Canvas__1nResetMatrix = Module['org_jetbrains_skia_Canvas__1nResetMatrix'] = createExportWrapper('org_jetbrains_skia_Canvas__1nResetMatrix');
var org_jetbrains_skia_Canvas__1nGetLocalToDevice = Module['org_jetbrains_skia_Canvas__1nGetLocalToDevice'] = createExportWrapper('org_jetbrains_skia_Canvas__1nGetLocalToDevice');
var org_jetbrains_skia_Canvas__1nClipRect = Module['org_jetbrains_skia_Canvas__1nClipRect'] = createExportWrapper('org_jetbrains_skia_Canvas__1nClipRect');
var org_jetbrains_skia_Canvas__1nClipRRect = Module['org_jetbrains_skia_Canvas__1nClipRRect'] = createExportWrapper('org_jetbrains_skia_Canvas__1nClipRRect');
var org_jetbrains_skia_Canvas__1nClipPath = Module['org_jetbrains_skia_Canvas__1nClipPath'] = createExportWrapper('org_jetbrains_skia_Canvas__1nClipPath');
var org_jetbrains_skia_Canvas__1nClipRegion = Module['org_jetbrains_skia_Canvas__1nClipRegion'] = createExportWrapper('org_jetbrains_skia_Canvas__1nClipRegion');
var org_jetbrains_skia_Canvas__1nConcat = Module['org_jetbrains_skia_Canvas__1nConcat'] = createExportWrapper('org_jetbrains_skia_Canvas__1nConcat');
var org_jetbrains_skia_Canvas__1nConcat44 = Module['org_jetbrains_skia_Canvas__1nConcat44'] = createExportWrapper('org_jetbrains_skia_Canvas__1nConcat44');
var org_jetbrains_skia_Canvas__1nTranslate = Module['org_jetbrains_skia_Canvas__1nTranslate'] = createExportWrapper('org_jetbrains_skia_Canvas__1nTranslate');
var org_jetbrains_skia_Canvas__1nScale = Module['org_jetbrains_skia_Canvas__1nScale'] = createExportWrapper('org_jetbrains_skia_Canvas__1nScale');
var org_jetbrains_skia_Canvas__1nRotate = Module['org_jetbrains_skia_Canvas__1nRotate'] = createExportWrapper('org_jetbrains_skia_Canvas__1nRotate');
var org_jetbrains_skia_Canvas__1nSkew = Module['org_jetbrains_skia_Canvas__1nSkew'] = createExportWrapper('org_jetbrains_skia_Canvas__1nSkew');
var org_jetbrains_skia_Canvas__1nReadPixels = Module['org_jetbrains_skia_Canvas__1nReadPixels'] = createExportWrapper('org_jetbrains_skia_Canvas__1nReadPixels');
var org_jetbrains_skia_Canvas__1nWritePixels = Module['org_jetbrains_skia_Canvas__1nWritePixels'] = createExportWrapper('org_jetbrains_skia_Canvas__1nWritePixels');
var org_jetbrains_skia_Canvas__1nSave = Module['org_jetbrains_skia_Canvas__1nSave'] = createExportWrapper('org_jetbrains_skia_Canvas__1nSave');
var org_jetbrains_skia_Canvas__1nSaveLayer = Module['org_jetbrains_skia_Canvas__1nSaveLayer'] = createExportWrapper('org_jetbrains_skia_Canvas__1nSaveLayer');
var org_jetbrains_skia_Canvas__1nSaveLayerRect = Module['org_jetbrains_skia_Canvas__1nSaveLayerRect'] = createExportWrapper('org_jetbrains_skia_Canvas__1nSaveLayerRect');
var org_jetbrains_skia_Canvas__1nSaveLayerSaveLayerRec = Module['org_jetbrains_skia_Canvas__1nSaveLayerSaveLayerRec'] = createExportWrapper('org_jetbrains_skia_Canvas__1nSaveLayerSaveLayerRec');
var org_jetbrains_skia_Canvas__1nSaveLayerSaveLayerRecRect = Module['org_jetbrains_skia_Canvas__1nSaveLayerSaveLayerRecRect'] = createExportWrapper('org_jetbrains_skia_Canvas__1nSaveLayerSaveLayerRecRect');
var org_jetbrains_skia_Canvas__1nGetSaveCount = Module['org_jetbrains_skia_Canvas__1nGetSaveCount'] = createExportWrapper('org_jetbrains_skia_Canvas__1nGetSaveCount');
var org_jetbrains_skia_Canvas__1nRestore = Module['org_jetbrains_skia_Canvas__1nRestore'] = createExportWrapper('org_jetbrains_skia_Canvas__1nRestore');
var org_jetbrains_skia_Canvas__1nRestoreToCount = Module['org_jetbrains_skia_Canvas__1nRestoreToCount'] = createExportWrapper('org_jetbrains_skia_Canvas__1nRestoreToCount');
var org_jetbrains_skia_Typeface__1nGetFontStyle = Module['org_jetbrains_skia_Typeface__1nGetFontStyle'] = createExportWrapper('org_jetbrains_skia_Typeface__1nGetFontStyle');
var org_jetbrains_skia_Typeface__1nIsFixedPitch = Module['org_jetbrains_skia_Typeface__1nIsFixedPitch'] = createExportWrapper('org_jetbrains_skia_Typeface__1nIsFixedPitch');
var org_jetbrains_skia_Typeface__1nGetVariationsCount = Module['org_jetbrains_skia_Typeface__1nGetVariationsCount'] = createExportWrapper('org_jetbrains_skia_Typeface__1nGetVariationsCount');
var org_jetbrains_skia_Typeface__1nGetVariations = Module['org_jetbrains_skia_Typeface__1nGetVariations'] = createExportWrapper('org_jetbrains_skia_Typeface__1nGetVariations');
var org_jetbrains_skia_Typeface__1nGetVariationAxesCount = Module['org_jetbrains_skia_Typeface__1nGetVariationAxesCount'] = createExportWrapper('org_jetbrains_skia_Typeface__1nGetVariationAxesCount');
var org_jetbrains_skia_Typeface__1nGetVariationAxes = Module['org_jetbrains_skia_Typeface__1nGetVariationAxes'] = createExportWrapper('org_jetbrains_skia_Typeface__1nGetVariationAxes');
var org_jetbrains_skia_Typeface__1nGetUniqueId = Module['org_jetbrains_skia_Typeface__1nGetUniqueId'] = createExportWrapper('org_jetbrains_skia_Typeface__1nGetUniqueId');
var org_jetbrains_skia_Typeface__1nEquals = Module['org_jetbrains_skia_Typeface__1nEquals'] = createExportWrapper('org_jetbrains_skia_Typeface__1nEquals');
var org_jetbrains_skia_Typeface__1nMakeClone = Module['org_jetbrains_skia_Typeface__1nMakeClone'] = createExportWrapper('org_jetbrains_skia_Typeface__1nMakeClone');
var org_jetbrains_skia_Typeface__1nGetUTF32Glyphs = Module['org_jetbrains_skia_Typeface__1nGetUTF32Glyphs'] = createExportWrapper('org_jetbrains_skia_Typeface__1nGetUTF32Glyphs');
var org_jetbrains_skia_Typeface__1nGetUTF32Glyph = Module['org_jetbrains_skia_Typeface__1nGetUTF32Glyph'] = createExportWrapper('org_jetbrains_skia_Typeface__1nGetUTF32Glyph');
var org_jetbrains_skia_Typeface__1nGetGlyphsCount = Module['org_jetbrains_skia_Typeface__1nGetGlyphsCount'] = createExportWrapper('org_jetbrains_skia_Typeface__1nGetGlyphsCount');
var org_jetbrains_skia_Typeface__1nGetTablesCount = Module['org_jetbrains_skia_Typeface__1nGetTablesCount'] = createExportWrapper('org_jetbrains_skia_Typeface__1nGetTablesCount');
var org_jetbrains_skia_Typeface__1nGetTableTagsCount = Module['org_jetbrains_skia_Typeface__1nGetTableTagsCount'] = createExportWrapper('org_jetbrains_skia_Typeface__1nGetTableTagsCount');
var org_jetbrains_skia_Typeface__1nGetTableTags = Module['org_jetbrains_skia_Typeface__1nGetTableTags'] = createExportWrapper('org_jetbrains_skia_Typeface__1nGetTableTags');
var org_jetbrains_skia_Typeface__1nGetTableSize = Module['org_jetbrains_skia_Typeface__1nGetTableSize'] = createExportWrapper('org_jetbrains_skia_Typeface__1nGetTableSize');
var org_jetbrains_skia_Typeface__1nGetTableData = Module['org_jetbrains_skia_Typeface__1nGetTableData'] = createExportWrapper('org_jetbrains_skia_Typeface__1nGetTableData');
var org_jetbrains_skia_Typeface__1nGetUnitsPerEm = Module['org_jetbrains_skia_Typeface__1nGetUnitsPerEm'] = createExportWrapper('org_jetbrains_skia_Typeface__1nGetUnitsPerEm');
var org_jetbrains_skia_Typeface__1nGetKerningPairAdjustments = Module['org_jetbrains_skia_Typeface__1nGetKerningPairAdjustments'] = createExportWrapper('org_jetbrains_skia_Typeface__1nGetKerningPairAdjustments');
var org_jetbrains_skia_Typeface__1nGetFamilyNames = Module['org_jetbrains_skia_Typeface__1nGetFamilyNames'] = createExportWrapper('org_jetbrains_skia_Typeface__1nGetFamilyNames');
var org_jetbrains_skia_Typeface__1nGetFamilyName = Module['org_jetbrains_skia_Typeface__1nGetFamilyName'] = createExportWrapper('org_jetbrains_skia_Typeface__1nGetFamilyName');
var org_jetbrains_skia_Typeface__1nGetBounds = Module['org_jetbrains_skia_Typeface__1nGetBounds'] = createExportWrapper('org_jetbrains_skia_Typeface__1nGetBounds');
var org_jetbrains_skia_Typeface__1nMakeEmptyTypeface = Module['org_jetbrains_skia_Typeface__1nMakeEmptyTypeface'] = createExportWrapper('org_jetbrains_skia_Typeface__1nMakeEmptyTypeface');
var org_jetbrains_skia_Bitmap__1nGetFinalizer = Module['org_jetbrains_skia_Bitmap__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nGetFinalizer');
var org_jetbrains_skia_Bitmap__1nMake = Module['org_jetbrains_skia_Bitmap__1nMake'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nMake');
var org_jetbrains_skia_Bitmap__1nMakeClone = Module['org_jetbrains_skia_Bitmap__1nMakeClone'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nMakeClone');
var org_jetbrains_skia_Bitmap__1nSwap = Module['org_jetbrains_skia_Bitmap__1nSwap'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nSwap');
var org_jetbrains_skia_Bitmap__1nGetImageInfo = Module['org_jetbrains_skia_Bitmap__1nGetImageInfo'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nGetImageInfo');
var org_jetbrains_skia_Bitmap__1nGetRowBytesAsPixels = Module['org_jetbrains_skia_Bitmap__1nGetRowBytesAsPixels'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nGetRowBytesAsPixels');
var org_jetbrains_skia_Bitmap__1nIsNull = Module['org_jetbrains_skia_Bitmap__1nIsNull'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nIsNull');
var org_jetbrains_skia_Bitmap__1nGetRowBytes = Module['org_jetbrains_skia_Bitmap__1nGetRowBytes'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nGetRowBytes');
var org_jetbrains_skia_Bitmap__1nSetAlphaType = Module['org_jetbrains_skia_Bitmap__1nSetAlphaType'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nSetAlphaType');
var org_jetbrains_skia_Bitmap__1nComputeByteSize = Module['org_jetbrains_skia_Bitmap__1nComputeByteSize'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nComputeByteSize');
var org_jetbrains_skia_Bitmap__1nIsImmutable = Module['org_jetbrains_skia_Bitmap__1nIsImmutable'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nIsImmutable');
var org_jetbrains_skia_Bitmap__1nSetImmutable = Module['org_jetbrains_skia_Bitmap__1nSetImmutable'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nSetImmutable');
var org_jetbrains_skia_Bitmap__1nReset = Module['org_jetbrains_skia_Bitmap__1nReset'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nReset');
var org_jetbrains_skia_Bitmap__1nComputeIsOpaque = Module['org_jetbrains_skia_Bitmap__1nComputeIsOpaque'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nComputeIsOpaque');
var org_jetbrains_skia_Bitmap__1nSetImageInfo = Module['org_jetbrains_skia_Bitmap__1nSetImageInfo'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nSetImageInfo');
var org_jetbrains_skia_Bitmap__1nAllocPixelsFlags = Module['org_jetbrains_skia_Bitmap__1nAllocPixelsFlags'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nAllocPixelsFlags');
var org_jetbrains_skia_Bitmap__1nAllocPixelsRowBytes = Module['org_jetbrains_skia_Bitmap__1nAllocPixelsRowBytes'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nAllocPixelsRowBytes');
var _free = createExportWrapper('free');
var org_jetbrains_skia_Bitmap__1nInstallPixels = Module['org_jetbrains_skia_Bitmap__1nInstallPixels'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nInstallPixels');
var org_jetbrains_skia_Bitmap__1nAllocPixels = Module['org_jetbrains_skia_Bitmap__1nAllocPixels'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nAllocPixels');
var org_jetbrains_skia_Bitmap__1nGetPixelRef = Module['org_jetbrains_skia_Bitmap__1nGetPixelRef'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nGetPixelRef');
var org_jetbrains_skia_Bitmap__1nGetPixelRefOriginX = Module['org_jetbrains_skia_Bitmap__1nGetPixelRefOriginX'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nGetPixelRefOriginX');
var org_jetbrains_skia_Bitmap__1nGetPixelRefOriginY = Module['org_jetbrains_skia_Bitmap__1nGetPixelRefOriginY'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nGetPixelRefOriginY');
var org_jetbrains_skia_Bitmap__1nSetPixelRef = Module['org_jetbrains_skia_Bitmap__1nSetPixelRef'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nSetPixelRef');
var org_jetbrains_skia_Bitmap__1nIsReadyToDraw = Module['org_jetbrains_skia_Bitmap__1nIsReadyToDraw'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nIsReadyToDraw');
var org_jetbrains_skia_Bitmap__1nGetGenerationId = Module['org_jetbrains_skia_Bitmap__1nGetGenerationId'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nGetGenerationId');
var org_jetbrains_skia_Bitmap__1nNotifyPixelsChanged = Module['org_jetbrains_skia_Bitmap__1nNotifyPixelsChanged'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nNotifyPixelsChanged');
var org_jetbrains_skia_Bitmap__1nEraseColor = Module['org_jetbrains_skia_Bitmap__1nEraseColor'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nEraseColor');
var org_jetbrains_skia_Bitmap__1nErase = Module['org_jetbrains_skia_Bitmap__1nErase'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nErase');
var org_jetbrains_skia_Bitmap__1nGetColor = Module['org_jetbrains_skia_Bitmap__1nGetColor'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nGetColor');
var org_jetbrains_skia_Bitmap__1nGetAlphaf = Module['org_jetbrains_skia_Bitmap__1nGetAlphaf'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nGetAlphaf');
var org_jetbrains_skia_Bitmap__1nExtractSubset = Module['org_jetbrains_skia_Bitmap__1nExtractSubset'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nExtractSubset');
var org_jetbrains_skia_Bitmap__1nReadPixels = Module['org_jetbrains_skia_Bitmap__1nReadPixels'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nReadPixels');
var org_jetbrains_skia_Bitmap__1nExtractAlpha = Module['org_jetbrains_skia_Bitmap__1nExtractAlpha'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nExtractAlpha');
var org_jetbrains_skia_Bitmap__1nPeekPixels = Module['org_jetbrains_skia_Bitmap__1nPeekPixels'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nPeekPixels');
var org_jetbrains_skia_Bitmap__1nMakeShader = Module['org_jetbrains_skia_Bitmap__1nMakeShader'] = createExportWrapper('org_jetbrains_skia_Bitmap__1nMakeShader');
var org_jetbrains_skia_Paint__1nGetFinalizer = Module['org_jetbrains_skia_Paint__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_Paint__1nGetFinalizer');
var org_jetbrains_skia_Paint__1nMake = Module['org_jetbrains_skia_Paint__1nMake'] = createExportWrapper('org_jetbrains_skia_Paint__1nMake');
var org_jetbrains_skia_Paint__1nMakeClone = Module['org_jetbrains_skia_Paint__1nMakeClone'] = createExportWrapper('org_jetbrains_skia_Paint__1nMakeClone');
var org_jetbrains_skia_Paint__1nEquals = Module['org_jetbrains_skia_Paint__1nEquals'] = createExportWrapper('org_jetbrains_skia_Paint__1nEquals');
var org_jetbrains_skia_Paint__1nReset = Module['org_jetbrains_skia_Paint__1nReset'] = createExportWrapper('org_jetbrains_skia_Paint__1nReset');
var org_jetbrains_skia_Paint__1nIsAntiAlias = Module['org_jetbrains_skia_Paint__1nIsAntiAlias'] = createExportWrapper('org_jetbrains_skia_Paint__1nIsAntiAlias');
var org_jetbrains_skia_Paint__1nSetAntiAlias = Module['org_jetbrains_skia_Paint__1nSetAntiAlias'] = createExportWrapper('org_jetbrains_skia_Paint__1nSetAntiAlias');
var org_jetbrains_skia_Paint__1nIsDither = Module['org_jetbrains_skia_Paint__1nIsDither'] = createExportWrapper('org_jetbrains_skia_Paint__1nIsDither');
var org_jetbrains_skia_Paint__1nSetDither = Module['org_jetbrains_skia_Paint__1nSetDither'] = createExportWrapper('org_jetbrains_skia_Paint__1nSetDither');
var org_jetbrains_skia_Paint__1nGetColor = Module['org_jetbrains_skia_Paint__1nGetColor'] = createExportWrapper('org_jetbrains_skia_Paint__1nGetColor');
var org_jetbrains_skia_Paint__1nSetColor = Module['org_jetbrains_skia_Paint__1nSetColor'] = createExportWrapper('org_jetbrains_skia_Paint__1nSetColor');
var org_jetbrains_skia_Paint__1nGetColor4f = Module['org_jetbrains_skia_Paint__1nGetColor4f'] = createExportWrapper('org_jetbrains_skia_Paint__1nGetColor4f');
var org_jetbrains_skia_Paint__1nSetColor4f = Module['org_jetbrains_skia_Paint__1nSetColor4f'] = createExportWrapper('org_jetbrains_skia_Paint__1nSetColor4f');
var org_jetbrains_skia_Paint__1nGetMode = Module['org_jetbrains_skia_Paint__1nGetMode'] = createExportWrapper('org_jetbrains_skia_Paint__1nGetMode');
var org_jetbrains_skia_Paint__1nSetMode = Module['org_jetbrains_skia_Paint__1nSetMode'] = createExportWrapper('org_jetbrains_skia_Paint__1nSetMode');
var org_jetbrains_skia_Paint__1nGetStrokeWidth = Module['org_jetbrains_skia_Paint__1nGetStrokeWidth'] = createExportWrapper('org_jetbrains_skia_Paint__1nGetStrokeWidth');
var org_jetbrains_skia_Paint__1nSetStrokeWidth = Module['org_jetbrains_skia_Paint__1nSetStrokeWidth'] = createExportWrapper('org_jetbrains_skia_Paint__1nSetStrokeWidth');
var org_jetbrains_skia_Paint__1nGetStrokeMiter = Module['org_jetbrains_skia_Paint__1nGetStrokeMiter'] = createExportWrapper('org_jetbrains_skia_Paint__1nGetStrokeMiter');
var org_jetbrains_skia_Paint__1nSetStrokeMiter = Module['org_jetbrains_skia_Paint__1nSetStrokeMiter'] = createExportWrapper('org_jetbrains_skia_Paint__1nSetStrokeMiter');
var org_jetbrains_skia_Paint__1nGetStrokeCap = Module['org_jetbrains_skia_Paint__1nGetStrokeCap'] = createExportWrapper('org_jetbrains_skia_Paint__1nGetStrokeCap');
var org_jetbrains_skia_Paint__1nSetStrokeCap = Module['org_jetbrains_skia_Paint__1nSetStrokeCap'] = createExportWrapper('org_jetbrains_skia_Paint__1nSetStrokeCap');
var org_jetbrains_skia_Paint__1nGetStrokeJoin = Module['org_jetbrains_skia_Paint__1nGetStrokeJoin'] = createExportWrapper('org_jetbrains_skia_Paint__1nGetStrokeJoin');
var org_jetbrains_skia_Paint__1nSetStrokeJoin = Module['org_jetbrains_skia_Paint__1nSetStrokeJoin'] = createExportWrapper('org_jetbrains_skia_Paint__1nSetStrokeJoin');
var org_jetbrains_skia_Paint__1nGetMaskFilter = Module['org_jetbrains_skia_Paint__1nGetMaskFilter'] = createExportWrapper('org_jetbrains_skia_Paint__1nGetMaskFilter');
var org_jetbrains_skia_Paint__1nSetMaskFilter = Module['org_jetbrains_skia_Paint__1nSetMaskFilter'] = createExportWrapper('org_jetbrains_skia_Paint__1nSetMaskFilter');
var org_jetbrains_skia_Paint__1nGetImageFilter = Module['org_jetbrains_skia_Paint__1nGetImageFilter'] = createExportWrapper('org_jetbrains_skia_Paint__1nGetImageFilter');
var org_jetbrains_skia_Paint__1nSetImageFilter = Module['org_jetbrains_skia_Paint__1nSetImageFilter'] = createExportWrapper('org_jetbrains_skia_Paint__1nSetImageFilter');
var org_jetbrains_skia_Paint__1nGetBlendMode = Module['org_jetbrains_skia_Paint__1nGetBlendMode'] = createExportWrapper('org_jetbrains_skia_Paint__1nGetBlendMode');
var org_jetbrains_skia_Paint__1nSetBlendMode = Module['org_jetbrains_skia_Paint__1nSetBlendMode'] = createExportWrapper('org_jetbrains_skia_Paint__1nSetBlendMode');
var org_jetbrains_skia_Paint__1nGetPathEffect = Module['org_jetbrains_skia_Paint__1nGetPathEffect'] = createExportWrapper('org_jetbrains_skia_Paint__1nGetPathEffect');
var org_jetbrains_skia_Paint__1nSetPathEffect = Module['org_jetbrains_skia_Paint__1nSetPathEffect'] = createExportWrapper('org_jetbrains_skia_Paint__1nSetPathEffect');
var org_jetbrains_skia_Paint__1nGetShader = Module['org_jetbrains_skia_Paint__1nGetShader'] = createExportWrapper('org_jetbrains_skia_Paint__1nGetShader');
var org_jetbrains_skia_Paint__1nSetShader = Module['org_jetbrains_skia_Paint__1nSetShader'] = createExportWrapper('org_jetbrains_skia_Paint__1nSetShader');
var org_jetbrains_skia_Paint__1nGetColorFilter = Module['org_jetbrains_skia_Paint__1nGetColorFilter'] = createExportWrapper('org_jetbrains_skia_Paint__1nGetColorFilter');
var org_jetbrains_skia_Paint__1nSetColorFilter = Module['org_jetbrains_skia_Paint__1nSetColorFilter'] = createExportWrapper('org_jetbrains_skia_Paint__1nSetColorFilter');
var org_jetbrains_skia_Paint__1nHasNothingToDraw = Module['org_jetbrains_skia_Paint__1nHasNothingToDraw'] = createExportWrapper('org_jetbrains_skia_Paint__1nHasNothingToDraw');
var org_jetbrains_skia_ImageFilter__1nMakeArithmetic = Module['org_jetbrains_skia_ImageFilter__1nMakeArithmetic'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeArithmetic');
var org_jetbrains_skia_ImageFilter__1nMakeBlend = Module['org_jetbrains_skia_ImageFilter__1nMakeBlend'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeBlend');
var org_jetbrains_skia_ImageFilter__1nMakeBlur = Module['org_jetbrains_skia_ImageFilter__1nMakeBlur'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeBlur');
var org_jetbrains_skia_ImageFilter__1nMakeColorFilter = Module['org_jetbrains_skia_ImageFilter__1nMakeColorFilter'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeColorFilter');
var org_jetbrains_skia_ImageFilter__1nMakeCompose = Module['org_jetbrains_skia_ImageFilter__1nMakeCompose'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeCompose');
var org_jetbrains_skia_ImageFilter__1nMakeDisplacementMap = Module['org_jetbrains_skia_ImageFilter__1nMakeDisplacementMap'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeDisplacementMap');
var org_jetbrains_skia_ImageFilter__1nMakeDropShadow = Module['org_jetbrains_skia_ImageFilter__1nMakeDropShadow'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeDropShadow');
var org_jetbrains_skia_ImageFilter__1nMakeDropShadowOnly = Module['org_jetbrains_skia_ImageFilter__1nMakeDropShadowOnly'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeDropShadowOnly');
var org_jetbrains_skia_ImageFilter__1nMakeImage = Module['org_jetbrains_skia_ImageFilter__1nMakeImage'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeImage');
var org_jetbrains_skia_ImageFilter__1nMakeMagnifier = Module['org_jetbrains_skia_ImageFilter__1nMakeMagnifier'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeMagnifier');
var org_jetbrains_skia_ImageFilter__1nMakeMatrixConvolution = Module['org_jetbrains_skia_ImageFilter__1nMakeMatrixConvolution'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeMatrixConvolution');
var org_jetbrains_skia_ImageFilter__1nMakeMatrixTransform = Module['org_jetbrains_skia_ImageFilter__1nMakeMatrixTransform'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeMatrixTransform');
var org_jetbrains_skia_ImageFilter__1nMakeMerge = Module['org_jetbrains_skia_ImageFilter__1nMakeMerge'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeMerge');
var org_jetbrains_skia_ImageFilter__1nMakeOffset = Module['org_jetbrains_skia_ImageFilter__1nMakeOffset'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeOffset');
var org_jetbrains_skia_ImageFilter__1nMakeShader = Module['org_jetbrains_skia_ImageFilter__1nMakeShader'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeShader');
var org_jetbrains_skia_ImageFilter__1nMakePicture = Module['org_jetbrains_skia_ImageFilter__1nMakePicture'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakePicture');
var org_jetbrains_skia_ImageFilter__1nMakeRuntimeShader = Module['org_jetbrains_skia_ImageFilter__1nMakeRuntimeShader'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeRuntimeShader');
var org_jetbrains_skia_ImageFilter__1nMakeRuntimeShaderFromArray = Module['org_jetbrains_skia_ImageFilter__1nMakeRuntimeShaderFromArray'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeRuntimeShaderFromArray');
var org_jetbrains_skia_ImageFilter__1nMakeTile = Module['org_jetbrains_skia_ImageFilter__1nMakeTile'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeTile');
var org_jetbrains_skia_ImageFilter__1nMakeDilate = Module['org_jetbrains_skia_ImageFilter__1nMakeDilate'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeDilate');
var org_jetbrains_skia_ImageFilter__1nMakeErode = Module['org_jetbrains_skia_ImageFilter__1nMakeErode'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeErode');
var org_jetbrains_skia_ImageFilter__1nMakeDistantLitDiffuse = Module['org_jetbrains_skia_ImageFilter__1nMakeDistantLitDiffuse'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeDistantLitDiffuse');
var org_jetbrains_skia_ImageFilter__1nMakePointLitDiffuse = Module['org_jetbrains_skia_ImageFilter__1nMakePointLitDiffuse'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakePointLitDiffuse');
var org_jetbrains_skia_ImageFilter__1nMakeSpotLitDiffuse = Module['org_jetbrains_skia_ImageFilter__1nMakeSpotLitDiffuse'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeSpotLitDiffuse');
var org_jetbrains_skia_ImageFilter__1nMakeDistantLitSpecular = Module['org_jetbrains_skia_ImageFilter__1nMakeDistantLitSpecular'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeDistantLitSpecular');
var org_jetbrains_skia_ImageFilter__1nMakePointLitSpecular = Module['org_jetbrains_skia_ImageFilter__1nMakePointLitSpecular'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakePointLitSpecular');
var org_jetbrains_skia_ImageFilter__1nMakeSpotLitSpecular = Module['org_jetbrains_skia_ImageFilter__1nMakeSpotLitSpecular'] = createExportWrapper('org_jetbrains_skia_ImageFilter__1nMakeSpotLitSpecular');
var org_jetbrains_skia_Image__1nMakeRaster = Module['org_jetbrains_skia_Image__1nMakeRaster'] = createExportWrapper('org_jetbrains_skia_Image__1nMakeRaster');
var org_jetbrains_skia_Image__1nMakeRasterData = Module['org_jetbrains_skia_Image__1nMakeRasterData'] = createExportWrapper('org_jetbrains_skia_Image__1nMakeRasterData');
var org_jetbrains_skia_Image__1nMakeFromBitmap = Module['org_jetbrains_skia_Image__1nMakeFromBitmap'] = createExportWrapper('org_jetbrains_skia_Image__1nMakeFromBitmap');
var org_jetbrains_skia_Image__1nMakeFromPixmap = Module['org_jetbrains_skia_Image__1nMakeFromPixmap'] = createExportWrapper('org_jetbrains_skia_Image__1nMakeFromPixmap');
var org_jetbrains_skia_Image__1nMakeFromEncoded = Module['org_jetbrains_skia_Image__1nMakeFromEncoded'] = createExportWrapper('org_jetbrains_skia_Image__1nMakeFromEncoded');
var org_jetbrains_skia_Image__1nGetImageInfo = Module['org_jetbrains_skia_Image__1nGetImageInfo'] = createExportWrapper('org_jetbrains_skia_Image__1nGetImageInfo');
var org_jetbrains_skia_Image__1nEncodeToData = Module['org_jetbrains_skia_Image__1nEncodeToData'] = createExportWrapper('org_jetbrains_skia_Image__1nEncodeToData');
var org_jetbrains_skia_Image__1nMakeShader = Module['org_jetbrains_skia_Image__1nMakeShader'] = createExportWrapper('org_jetbrains_skia_Image__1nMakeShader');
var org_jetbrains_skia_Image__1nPeekPixels = Module['org_jetbrains_skia_Image__1nPeekPixels'] = createExportWrapper('org_jetbrains_skia_Image__1nPeekPixels');
var org_jetbrains_skia_Image__1nPeekPixelsToPixmap = Module['org_jetbrains_skia_Image__1nPeekPixelsToPixmap'] = createExportWrapper('org_jetbrains_skia_Image__1nPeekPixelsToPixmap');
var org_jetbrains_skia_Image__1nReadPixelsBitmap = Module['org_jetbrains_skia_Image__1nReadPixelsBitmap'] = createExportWrapper('org_jetbrains_skia_Image__1nReadPixelsBitmap');
var org_jetbrains_skia_Image__1nReadPixelsPixmap = Module['org_jetbrains_skia_Image__1nReadPixelsPixmap'] = createExportWrapper('org_jetbrains_skia_Image__1nReadPixelsPixmap');
var org_jetbrains_skia_Image__1nScalePixels = Module['org_jetbrains_skia_Image__1nScalePixels'] = createExportWrapper('org_jetbrains_skia_Image__1nScalePixels');
var org_jetbrains_skia_PictureRecorder__1nMake = Module['org_jetbrains_skia_PictureRecorder__1nMake'] = createExportWrapper('org_jetbrains_skia_PictureRecorder__1nMake');
var org_jetbrains_skia_PictureRecorder__1nGetFinalizer = Module['org_jetbrains_skia_PictureRecorder__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_PictureRecorder__1nGetFinalizer');
var org_jetbrains_skia_PictureRecorder__1nBeginRecording = Module['org_jetbrains_skia_PictureRecorder__1nBeginRecording'] = createExportWrapper('org_jetbrains_skia_PictureRecorder__1nBeginRecording');
var org_jetbrains_skia_PictureRecorder__1nGetRecordingCanvas = Module['org_jetbrains_skia_PictureRecorder__1nGetRecordingCanvas'] = createExportWrapper('org_jetbrains_skia_PictureRecorder__1nGetRecordingCanvas');
var org_jetbrains_skia_PictureRecorder__1nFinishRecordingAsPicture = Module['org_jetbrains_skia_PictureRecorder__1nFinishRecordingAsPicture'] = createExportWrapper('org_jetbrains_skia_PictureRecorder__1nFinishRecordingAsPicture');
var org_jetbrains_skia_PictureRecorder__1nFinishRecordingAsPictureWithCull = Module['org_jetbrains_skia_PictureRecorder__1nFinishRecordingAsPictureWithCull'] = createExportWrapper('org_jetbrains_skia_PictureRecorder__1nFinishRecordingAsPictureWithCull');
var org_jetbrains_skia_PictureRecorder__1nFinishRecordingAsDrawable = Module['org_jetbrains_skia_PictureRecorder__1nFinishRecordingAsDrawable'] = createExportWrapper('org_jetbrains_skia_PictureRecorder__1nFinishRecordingAsDrawable');
var _fflush = Module['_fflush'] = createExportWrapper('fflush');
var _skia_memGetByte = Module['_skia_memGetByte'] = createExportWrapper('skia_memGetByte');
var _skia_memSetByte = Module['_skia_memSetByte'] = createExportWrapper('skia_memSetByte');
var _skia_memGetChar = Module['_skia_memGetChar'] = createExportWrapper('skia_memGetChar');
var _skia_memSetChar = Module['_skia_memSetChar'] = createExportWrapper('skia_memSetChar');
var _skia_memGetShort = Module['_skia_memGetShort'] = createExportWrapper('skia_memGetShort');
var _skia_memSetShort = Module['_skia_memSetShort'] = createExportWrapper('skia_memSetShort');
var _skia_memGetInt = Module['_skia_memGetInt'] = createExportWrapper('skia_memGetInt');
var _skia_memSetInt = Module['_skia_memSetInt'] = createExportWrapper('skia_memSetInt');
var _skia_memGetFloat = Module['_skia_memGetFloat'] = createExportWrapper('skia_memGetFloat');
var _skia_memSetFloat = Module['_skia_memSetFloat'] = createExportWrapper('skia_memSetFloat');
var _skia_memGetDouble = Module['_skia_memGetDouble'] = createExportWrapper('skia_memGetDouble');
var _skia_memSetDouble = Module['_skia_memSetDouble'] = createExportWrapper('skia_memSetDouble');
var org_jetbrains_skia_icu_Unicode_charDirection = Module['org_jetbrains_skia_icu_Unicode_charDirection'] = createExportWrapper('org_jetbrains_skia_icu_Unicode_charDirection');
var org_jetbrains_skia_skottie_Animation__1nGetFinalizer = Module['org_jetbrains_skia_skottie_Animation__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_skottie_Animation__1nGetFinalizer');
var org_jetbrains_skia_skottie_Animation__1nMakeFromString = Module['org_jetbrains_skia_skottie_Animation__1nMakeFromString'] = createExportWrapper('org_jetbrains_skia_skottie_Animation__1nMakeFromString');
var org_jetbrains_skia_skottie_Animation__1nMakeFromFile = Module['org_jetbrains_skia_skottie_Animation__1nMakeFromFile'] = createExportWrapper('org_jetbrains_skia_skottie_Animation__1nMakeFromFile');
var org_jetbrains_skia_skottie_Animation__1nMakeFromData = Module['org_jetbrains_skia_skottie_Animation__1nMakeFromData'] = createExportWrapper('org_jetbrains_skia_skottie_Animation__1nMakeFromData');
var org_jetbrains_skia_skottie_Animation__1nRender = Module['org_jetbrains_skia_skottie_Animation__1nRender'] = createExportWrapper('org_jetbrains_skia_skottie_Animation__1nRender');
var org_jetbrains_skia_skottie_Animation__1nSeek = Module['org_jetbrains_skia_skottie_Animation__1nSeek'] = createExportWrapper('org_jetbrains_skia_skottie_Animation__1nSeek');
var org_jetbrains_skia_skottie_Animation__1nSeekFrame = Module['org_jetbrains_skia_skottie_Animation__1nSeekFrame'] = createExportWrapper('org_jetbrains_skia_skottie_Animation__1nSeekFrame');
var org_jetbrains_skia_skottie_Animation__1nSeekFrameTime = Module['org_jetbrains_skia_skottie_Animation__1nSeekFrameTime'] = createExportWrapper('org_jetbrains_skia_skottie_Animation__1nSeekFrameTime');
var org_jetbrains_skia_skottie_Animation__1nGetDuration = Module['org_jetbrains_skia_skottie_Animation__1nGetDuration'] = createExportWrapper('org_jetbrains_skia_skottie_Animation__1nGetDuration');
var org_jetbrains_skia_skottie_Animation__1nGetFPS = Module['org_jetbrains_skia_skottie_Animation__1nGetFPS'] = createExportWrapper('org_jetbrains_skia_skottie_Animation__1nGetFPS');
var org_jetbrains_skia_skottie_Animation__1nGetInPoint = Module['org_jetbrains_skia_skottie_Animation__1nGetInPoint'] = createExportWrapper('org_jetbrains_skia_skottie_Animation__1nGetInPoint');
var org_jetbrains_skia_skottie_Animation__1nGetOutPoint = Module['org_jetbrains_skia_skottie_Animation__1nGetOutPoint'] = createExportWrapper('org_jetbrains_skia_skottie_Animation__1nGetOutPoint');
var org_jetbrains_skia_skottie_Animation__1nGetVersion = Module['org_jetbrains_skia_skottie_Animation__1nGetVersion'] = createExportWrapper('org_jetbrains_skia_skottie_Animation__1nGetVersion');
var org_jetbrains_skia_skottie_Animation__1nGetSize = Module['org_jetbrains_skia_skottie_Animation__1nGetSize'] = createExportWrapper('org_jetbrains_skia_skottie_Animation__1nGetSize');
var org_jetbrains_skia_skottie_AnimationBuilder__1nGetFinalizer = Module['org_jetbrains_skia_skottie_AnimationBuilder__1nGetFinalizer'] = createExportWrapper('org_jetbrains_skia_skottie_AnimationBuilder__1nGetFinalizer');
var org_jetbrains_skia_skottie_AnimationBuilder__1nMake = Module['org_jetbrains_skia_skottie_AnimationBuilder__1nMake'] = createExportWrapper('org_jetbrains_skia_skottie_AnimationBuilder__1nMake');
var org_jetbrains_skia_skottie_AnimationBuilder__1nSetFontManager = Module['org_jetbrains_skia_skottie_AnimationBuilder__1nSetFontManager'] = createExportWrapper('org_jetbrains_skia_skottie_AnimationBuilder__1nSetFontManager');
var org_jetbrains_skia_skottie_AnimationBuilder__1nSetLogger = Module['org_jetbrains_skia_skottie_AnimationBuilder__1nSetLogger'] = createExportWrapper('org_jetbrains_skia_skottie_AnimationBuilder__1nSetLogger');
var org_jetbrains_skia_skottie_AnimationBuilder__1nBuildFromString = Module['org_jetbrains_skia_skottie_AnimationBuilder__1nBuildFromString'] = createExportWrapper('org_jetbrains_skia_skottie_AnimationBuilder__1nBuildFromString');
var org_jetbrains_skia_skottie_AnimationBuilder__1nBuildFromFile = Module['org_jetbrains_skia_skottie_AnimationBuilder__1nBuildFromFile'] = createExportWrapper('org_jetbrains_skia_skottie_AnimationBuilder__1nBuildFromFile');
var org_jetbrains_skia_skottie_AnimationBuilder__1nBuildFromData = Module['org_jetbrains_skia_skottie_AnimationBuilder__1nBuildFromData'] = createExportWrapper('org_jetbrains_skia_skottie_AnimationBuilder__1nBuildFromData');
var org_jetbrains_skia_skottie_Logger__1nMake = Module['org_jetbrains_skia_skottie_Logger__1nMake'] = createExportWrapper('org_jetbrains_skia_skottie_Logger__1nMake');
var org_jetbrains_skia_skottie_Logger__1nInit = Module['org_jetbrains_skia_skottie_Logger__1nInit'] = createExportWrapper('org_jetbrains_skia_skottie_Logger__1nInit');
var org_jetbrains_skia_skottie_Logger__1nGetLogMessage = Module['org_jetbrains_skia_skottie_Logger__1nGetLogMessage'] = createExportWrapper('org_jetbrains_skia_skottie_Logger__1nGetLogMessage');
var org_jetbrains_skia_skottie_Logger__1nGetLogJson = Module['org_jetbrains_skia_skottie_Logger__1nGetLogJson'] = createExportWrapper('org_jetbrains_skia_skottie_Logger__1nGetLogJson');
var org_jetbrains_skia_skottie_Logger__1nGetLogLevel = Module['org_jetbrains_skia_skottie_Logger__1nGetLogLevel'] = createExportWrapper('org_jetbrains_skia_skottie_Logger__1nGetLogLevel');
var org_jetbrains_skia_FontStyleSet__1nMakeEmpty = Module['org_jetbrains_skia_FontStyleSet__1nMakeEmpty'] = createExportWrapper('org_jetbrains_skia_FontStyleSet__1nMakeEmpty');
var org_jetbrains_skia_FontStyleSet__1nCount = Module['org_jetbrains_skia_FontStyleSet__1nCount'] = createExportWrapper('org_jetbrains_skia_FontStyleSet__1nCount');
var org_jetbrains_skia_FontStyleSet__1nGetStyle = Module['org_jetbrains_skia_FontStyleSet__1nGetStyle'] = createExportWrapper('org_jetbrains_skia_FontStyleSet__1nGetStyle');
var org_jetbrains_skia_FontStyleSet__1nGetStyleName = Module['org_jetbrains_skia_FontStyleSet__1nGetStyleName'] = createExportWrapper('org_jetbrains_skia_FontStyleSet__1nGetStyleName');
var org_jetbrains_skia_FontStyleSet__1nGetTypeface = Module['org_jetbrains_skia_FontStyleSet__1nGetTypeface'] = createExportWrapper('org_jetbrains_skia_FontStyleSet__1nGetTypeface');
var org_jetbrains_skia_FontStyleSet__1nMatchStyle = Module['org_jetbrains_skia_FontStyleSet__1nMatchStyle'] = createExportWrapper('org_jetbrains_skia_FontStyleSet__1nMatchStyle');
var org_jetbrains_skiko_RenderTargetsKt_makeGLRenderTargetNative = Module['org_jetbrains_skiko_RenderTargetsKt_makeGLRenderTargetNative'] = createExportWrapper('org_jetbrains_skiko_RenderTargetsKt_makeGLRenderTargetNative');
var org_jetbrains_skiko_RenderTargetsKt_makeGLContextNative = Module['org_jetbrains_skiko_RenderTargetsKt_makeGLContextNative'] = createExportWrapper('org_jetbrains_skiko_RenderTargetsKt_makeGLContextNative');
var org_jetbrains_skiko_RenderTargetsKt_makeMetalRenderTargetNative = Module['org_jetbrains_skiko_RenderTargetsKt_makeMetalRenderTargetNative'] = createExportWrapper('org_jetbrains_skiko_RenderTargetsKt_makeMetalRenderTargetNative');
var org_jetbrains_skiko_RenderTargetsKt_makeMetalContextNative = Module['org_jetbrains_skiko_RenderTargetsKt_makeMetalContextNative'] = createExportWrapper('org_jetbrains_skiko_RenderTargetsKt_makeMetalContextNative');
var org_jetbrains_skia_DirectContext__1nMakeGL = Module['org_jetbrains_skia_DirectContext__1nMakeGL'] = createExportWrapper('org_jetbrains_skia_DirectContext__1nMakeGL');
var org_jetbrains_skia_DirectContext__1nMakeGLWithInterface = Module['org_jetbrains_skia_DirectContext__1nMakeGLWithInterface'] = createExportWrapper('org_jetbrains_skia_DirectContext__1nMakeGLWithInterface');
var org_jetbrains_skia_DirectContext__1nMakeMetal = Module['org_jetbrains_skia_DirectContext__1nMakeMetal'] = createExportWrapper('org_jetbrains_skia_DirectContext__1nMakeMetal');
var org_jetbrains_skia_DirectContext__1nMakeDirect3D = Module['org_jetbrains_skia_DirectContext__1nMakeDirect3D'] = createExportWrapper('org_jetbrains_skia_DirectContext__1nMakeDirect3D');
var org_jetbrains_skia_DirectContext__1nFlushDefault = Module['org_jetbrains_skia_DirectContext__1nFlushDefault'] = createExportWrapper('org_jetbrains_skia_DirectContext__1nFlushDefault');
var org_jetbrains_skia_DirectContext__1nFlush = Module['org_jetbrains_skia_DirectContext__1nFlush'] = createExportWrapper('org_jetbrains_skia_DirectContext__1nFlush');
var org_jetbrains_skia_DirectContext__1nFlushAndSubmit = Module['org_jetbrains_skia_DirectContext__1nFlushAndSubmit'] = createExportWrapper('org_jetbrains_skia_DirectContext__1nFlushAndSubmit');
var org_jetbrains_skia_DirectContext__1nSubmit = Module['org_jetbrains_skia_DirectContext__1nSubmit'] = createExportWrapper('org_jetbrains_skia_DirectContext__1nSubmit');
var org_jetbrains_skia_DirectContext__1nReset = Module['org_jetbrains_skia_DirectContext__1nReset'] = createExportWrapper('org_jetbrains_skia_DirectContext__1nReset');
var org_jetbrains_skia_DirectContext__1nAbandon = Module['org_jetbrains_skia_DirectContext__1nAbandon'] = createExportWrapper('org_jetbrains_skia_DirectContext__1nAbandon');
var ___errno_location = createExportWrapper('__errno_location');
var setTempRet0 = createExportWrapper('setTempRet0');
var _emscripten_builtin_memalign = createExportWrapper('emscripten_builtin_memalign');
var _setThrew = createExportWrapper('setThrew');
var _emscripten_stack_init = () => (_emscripten_stack_init = wasmExports['emscripten_stack_init'])();
var _emscripten_stack_get_free = () => (_emscripten_stack_get_free = wasmExports['emscripten_stack_get_free'])();
var _emscripten_stack_get_base = () => (_emscripten_stack_get_base = wasmExports['emscripten_stack_get_base'])();
var _emscripten_stack_get_end = () => (_emscripten_stack_get_end = wasmExports['emscripten_stack_get_end'])();
var stackSave = createExportWrapper('stackSave');
var stackRestore = createExportWrapper('stackRestore');
var stackAlloc = createExportWrapper('stackAlloc');
var _emscripten_stack_get_current = () => (_emscripten_stack_get_current = wasmExports['emscripten_stack_get_current'])();
var ___cxa_is_pointer_type = createExportWrapper('__cxa_is_pointer_type');
var dynCall_viji = Module['dynCall_viji'] = createExportWrapper('dynCall_viji');
var dynCall_vijiii = Module['dynCall_vijiii'] = createExportWrapper('dynCall_vijiii');
var dynCall_viiiiij = Module['dynCall_viiiiij'] = createExportWrapper('dynCall_viiiiij');
var dynCall_jii = Module['dynCall_jii'] = createExportWrapper('dynCall_jii');
var dynCall_vij = Module['dynCall_vij'] = createExportWrapper('dynCall_vij');
var dynCall_iiij = Module['dynCall_iiij'] = createExportWrapper('dynCall_iiij');
var dynCall_iiiij = Module['dynCall_iiiij'] = createExportWrapper('dynCall_iiiij');
var dynCall_viij = Module['dynCall_viij'] = createExportWrapper('dynCall_viij');
var dynCall_viiij = Module['dynCall_viiij'] = createExportWrapper('dynCall_viiij');
var dynCall_jiiiii = Module['dynCall_jiiiii'] = createExportWrapper('dynCall_jiiiii');
var dynCall_jiiiiii = Module['dynCall_jiiiiii'] = createExportWrapper('dynCall_jiiiiii');
var dynCall_jiiiiji = Module['dynCall_jiiiiji'] = createExportWrapper('dynCall_jiiiiji');
var dynCall_ji = Module['dynCall_ji'] = createExportWrapper('dynCall_ji');
var dynCall_iijj = Module['dynCall_iijj'] = createExportWrapper('dynCall_iijj');
var dynCall_iiji = Module['dynCall_iiji'] = createExportWrapper('dynCall_iiji');
var dynCall_iijjiii = Module['dynCall_iijjiii'] = createExportWrapper('dynCall_iijjiii');
var dynCall_iij = Module['dynCall_iij'] = createExportWrapper('dynCall_iij');
var dynCall_vijjjii = Module['dynCall_vijjjii'] = createExportWrapper('dynCall_vijjjii');
var dynCall_iiiji = Module['dynCall_iiiji'] = createExportWrapper('dynCall_iiiji');
var dynCall_jiji = Module['dynCall_jiji'] = createExportWrapper('dynCall_jiji');
var dynCall_viijii = Module['dynCall_viijii'] = createExportWrapper('dynCall_viijii');
var dynCall_iiiiij = Module['dynCall_iiiiij'] = createExportWrapper('dynCall_iiiiij');
var dynCall_iiiiijj = Module['dynCall_iiiiijj'] = createExportWrapper('dynCall_iiiiijj');
var dynCall_iiiiiijj = Module['dynCall_iiiiiijj'] = createExportWrapper('dynCall_iiiiiijj');

function invoke_viiii(index,a1,a2,a3,a4) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1,a2,a3,a4);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiii(index,a1,a2,a3,a4) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1,a2,a3,a4);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1,a2,a3);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_ii(index,a1) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_vi(index,a1) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iii(index,a1,a2) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1,a2);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viii(index,a1,a2,a3) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1,a2,a3);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_vii(index,a1,a2) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1,a2);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8,a9) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1,a2,a3,a4,a5,a6,a7,a8,a9);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_v(index) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)();
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiiiii(index,a1,a2,a3,a4,a5,a6) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1,a2,a3,a4,a5,a6);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiiii(index,a1,a2,a3,a4,a5) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1,a2,a3,a4,a5);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiiiii(index,a1,a2,a3,a4,a5,a6) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1,a2,a3,a4,a5,a6);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiiii(index,a1,a2,a3,a4,a5) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1,a2,a3,a4,a5);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8,a9) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1,a2,a3,a4,a5,a6,a7,a8,a9);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0) throw e;
    _setThrew(1, 0);
  }
}


// include: postamble.js
// === Auto-generated postamble setup entry stuff ===

var missingLibrarySymbols = [
  'writeI53ToI64Clamped',
  'writeI53ToI64Signaling',
  'writeI53ToU64Clamped',
  'writeI53ToU64Signaling',
  'convertU32PairToI53',
  'ydayFromDate',
  'inetPton4',
  'inetNtop4',
  'inetPton6',
  'inetNtop6',
  'readSockaddr',
  'writeSockaddr',
  'getHostByName',
  'getCallstack',
  'emscriptenLog',
  'convertPCtoSourceLocation',
  'runMainThreadEmAsm',
  'jstoi_s',
  'listenOnce',
  'autoResumeAudioContext',
  'dynCallLegacy',
  'getDynCaller',
  'dynCall',
  'handleException',
  'runtimeKeepalivePush',
  'runtimeKeepalivePop',
  'callUserCallback',
  'maybeExit',
  'asmjsMangle',
  'getNativeTypeSize',
  'STACK_SIZE',
  'STACK_ALIGN',
  'POINTER_SIZE',
  'ASSERTIONS',
  'getCFunc',
  'ccall',
  'cwrap',
  'uleb128Encode',
  'sigToWasmTypes',
  'generateFuncType',
  'convertJsFunctionToWasm',
  'getEmptyTableSlot',
  'updateTableMap',
  'getFunctionAddress',
  'addFunction',
  'removeFunction',
  'reallyNegative',
  'unSign',
  'strLen',
  'reSign',
  'formatString',
  'intArrayToString',
  'AsciiToString',
  'stringToUTF8OnStack',
  'registerKeyEventCallback',
  'maybeCStringToJsString',
  'findEventTarget',
  'findCanvasEventTarget',
  'getBoundingClientRect',
  'fillMouseEventData',
  'registerMouseEventCallback',
  'registerWheelEventCallback',
  'registerUiEventCallback',
  'registerFocusEventCallback',
  'fillDeviceOrientationEventData',
  'registerDeviceOrientationEventCallback',
  'fillDeviceMotionEventData',
  'registerDeviceMotionEventCallback',
  'screenOrientation',
  'fillOrientationChangeEventData',
  'registerOrientationChangeEventCallback',
  'fillFullscreenChangeEventData',
  'registerFullscreenChangeEventCallback',
  'JSEvents_requestFullscreen',
  'JSEvents_resizeCanvasForFullscreen',
  'registerRestoreOldStyle',
  'hideEverythingExceptGivenElement',
  'restoreHiddenElements',
  'setLetterbox',
  'softFullscreenResizeWebGLRenderTarget',
  'doRequestFullscreen',
  'fillPointerlockChangeEventData',
  'registerPointerlockChangeEventCallback',
  'registerPointerlockErrorEventCallback',
  'requestPointerLock',
  'fillVisibilityChangeEventData',
  'registerVisibilityChangeEventCallback',
  'registerTouchEventCallback',
  'fillGamepadEventData',
  'registerGamepadEventCallback',
  'registerBeforeUnloadEventCallback',
  'fillBatteryEventData',
  'battery',
  'registerBatteryEventCallback',
  'setCanvasElementSize',
  'getCanvasElementSize',
  'jsStackTrace',
  'stackTrace',
  'checkWasiClock',
  'wasiRightsToMuslOFlags',
  'wasiOFlagsToMuslOFlags',
  'createDyncallWrapper',
  'safeSetTimeout',
  'setImmediateWrapped',
  'clearImmediateWrapped',
  'polyfillSetImmediate',
  'getPromise',
  'makePromise',
  'idsToPromises',
  'makePromiseCallback',
  'ExceptionInfo',
  'findMatchingCatch',
  'setMainLoop',
  'getSocketFromFD',
  'getSocketAddress',
  'FS_unlink',
  'FS_mkdirTree',
  '_setNetworkCallback',
  'emscriptenWebGLGetUniform',
  'emscriptenWebGLGetVertexAttrib',
  '__glGetActiveAttribOrUniform',
  'writeGLArray',
  'registerWebGlEventCallback',
  'runAndAbortIfError',
  'SDL_unicode',
  'SDL_ttfContext',
  'SDL_audio',
  'emscriptenWebGLGetIndexed',
  'ALLOC_NORMAL',
  'ALLOC_STACK',
  'allocate',
  'writeStringToMemory',
  'writeAsciiToMemory',
  'getTypeName',
  'getFunctionName',
  'getFunctionArgsName',
  'heap32VectorToArray',
  'requireRegisteredType',
  'init_embind',
  'throwUnboundTypeError',
  'ensureOverloadTable',
  'exposePublicSymbol',
  'replacePublicSymbol',
  'extendError',
  'createNamedFunction',
  'getBasestPointer',
  'registerInheritedInstance',
  'unregisterInheritedInstance',
  'getInheritedInstance',
  'getInheritedInstanceCount',
  'getLiveInheritedInstances',
  'enumReadValueFromPointer',
  'runDestructors',
  'newFunc',
  'craftInvokerFunction',
  'embind__requireFunction',
  'genericPointerToWireType',
  'constNoSmartPtrRawPointerToWireType',
  'nonConstNoSmartPtrRawPointerToWireType',
  'init_RegisteredPointer',
  'RegisteredPointer',
  'RegisteredPointer_fromWireType',
  'runDestructor',
  'releaseClassHandle',
  'detachFinalizer',
  'attachFinalizer',
  'makeClassHandle',
  'init_ClassHandle',
  'ClassHandle',
  'throwInstanceAlreadyDeleted',
  'flushPendingDeletes',
  'setDelayFunction',
  'RegisteredClass',
  'shallowCopyInternalPointer',
  'downcastPointer',
  'upcastPointer',
  'validateThis',
  'char_0',
  'char_9',
  'makeLegalFunctionName',
  'getStringOrSymbol',
  'emval_get_global',
  'emval_returnValue',
  'emval_lookupTypes',
  'emval_addMethodCaller',
];
missingLibrarySymbols.forEach(missingLibrarySymbol)

var unexportedSymbols = [
  'run',
  'addOnPreRun',
  'addOnInit',
  'addOnPreMain',
  'addOnExit',
  'addOnPostRun',
  'addRunDependency',
  'removeRunDependency',
  'FS_createFolder',
  'FS_createPath',
  'FS_createLazyFile',
  'FS_createLink',
  'FS_createDevice',
  'FS_readFile',
  'out',
  'err',
  'callMain',
  'abort',
  'wasmMemory',
  'wasmExports',
  'stackAlloc',
  'stackSave',
  'stackRestore',
  'getTempRet0',
  'setTempRet0',
  'writeStackCookie',
  'checkStackCookie',
  'writeI53ToI64',
  'readI53FromI64',
  'readI53FromU64',
  'convertI32PairToI53',
  'convertI32PairToI53Checked',
  'ptrToString',
  'zeroMemory',
  'exitJS',
  'getHeapMax',
  'growMemory',
  'ENV',
  'MONTH_DAYS_REGULAR',
  'MONTH_DAYS_LEAP',
  'MONTH_DAYS_REGULAR_CUMULATIVE',
  'MONTH_DAYS_LEAP_CUMULATIVE',
  'isLeapYear',
  'arraySum',
  'addDays',
  'ERRNO_CODES',
  'ERRNO_MESSAGES',
  'setErrNo',
  'DNS',
  'Protocols',
  'Sockets',
  'initRandomFill',
  'randomFill',
  'timers',
  'warnOnce',
  'UNWIND_CACHE',
  'readEmAsmArgsArray',
  'readEmAsmArgs',
  'runEmAsmFunction',
  'jstoi_q',
  'getExecutableName',
  'keepRuntimeAlive',
  'asyncLoad',
  'alignMemory',
  'mmapAlloc',
  'handleAllocatorInit',
  'HandleAllocator',
  'wasmTable',
  'noExitRuntime',
  'freeTableIndexes',
  'functionsInTableMap',
  'setValue',
  'getValue',
  'PATH',
  'PATH_FS',
  'UTF8Decoder',
  'UTF8ArrayToString',
  'UTF8ToString',
  'stringToUTF8Array',
  'stringToUTF8',
  'lengthBytesUTF8',
  'intArrayFromString',
  'stringToAscii',
  'UTF16Decoder',
  'UTF16ToString',
  'stringToUTF16',
  'lengthBytesUTF16',
  'UTF32ToString',
  'stringToUTF32',
  'lengthBytesUTF32',
  'stringToNewUTF8',
  'writeArrayToMemory',
  'JSEvents',
  'specialHTMLTargets',
  'currentFullscreenStrategy',
  'restoreOldWindowedStyle',
  'demangle',
  'demangleAll',
  'ExitStatus',
  'getEnvStrings',
  'doReadv',
  'doWritev',
  'promiseMap',
  'uncaughtExceptionCount',
  'exceptionLast',
  'exceptionCaught',
  'Browser',
  'wget',
  'SYSCALLS',
  'preloadPlugins',
  'FS_createPreloadedFile',
  'FS_modeStringToFlags',
  'FS_getMode',
  'FS_stdin_getChar_buffer',
  'FS_stdin_getChar',
  'FS',
  'FS_createDataFile',
  'MEMFS',
  'TTY',
  'PIPEFS',
  'SOCKFS',
  'tempFixedLengthArray',
  'miniTempWebGLFloatBuffers',
  'miniTempWebGLIntBuffers',
  'heapObjectForWebGLType',
  'heapAccessShiftForWebGLHeap',
  'webgl_enable_WEBGL_multi_draw',
  'GL',
  'emscriptenWebGLGet',
  'computeUnpackAlignedImageSize',
  'colorChannelsInGlTextureFormat',
  'emscriptenWebGLGetTexPixelData',
  '__glGenObject',
  'webglGetUniformLocation',
  'webglPrepareUniformLocationsBeforeFirstUse',
  'webglGetLeftBracePos',
  'emscripten_webgl_power_preferences',
  'AL',
  'GLUT',
  'EGL',
  'GLEW',
  'IDBStore',
  'SDL',
  'SDL_gfx',
  'webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance',
  'webgl_enable_WEBGL_multi_draw_instanced_base_vertex_base_instance',
  'allocateUTF8',
  'allocateUTF8OnStack',
  'InternalError',
  'BindingError',
  'throwInternalError',
  'throwBindingError',
  'registeredTypes',
  'awaitingDependencies',
  'typeDependencies',
  'tupleRegistrations',
  'structRegistrations',
  'sharedRegisterType',
  'whenDependentTypesAreResolved',
  'embind_charCodes',
  'embind_init_charCodes',
  'readLatin1String',
  'UnboundTypeError',
  'PureVirtualError',
  'GenericWireTypeSize',
  'embindRepr',
  'registeredInstances',
  'registeredPointers',
  'registerType',
  'integerReadValueFromPointer',
  'floatReadValueFromPointer',
  'simpleReadValueFromPointer',
  'readPointer',
  'finalizationRegistry',
  'detachFinalizer_deps',
  'deletionQueue',
  'delayFunction',
  'emval_handles',
  'emval_symbols',
  'init_emval',
  'count_emval_handles',
  'Emval',
  'emval_methodCallers',
  'reflectConstruct',
];
unexportedSymbols.forEach(unexportedRuntimeSymbol);



var calledRun;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!calledRun) run();
  if (!calledRun) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
};

function stackCheckInit() {
  // This is normally called automatically during __wasm_call_ctors but need to
  // get these values before even running any of the ctors so we call it redundantly
  // here.
  _emscripten_stack_init();
  // TODO(sbc): Move writeStackCookie to native to to avoid this.
  writeStackCookie();
}

function run() {

  if (runDependencies > 0) {
    return;
  }

    stackCheckInit();

  preRun();

  // a preRun added a dependency, run will be called later
  if (runDependencies > 0) {
    return;
  }

  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    if (calledRun) return;
    calledRun = true;
    Module['calledRun'] = true;

    if (ABORT) return;

    initRuntime();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else
  {
    doRun();
  }
  checkStackCookie();
}

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var oldOut = out;
  var oldErr = err;
  var has = false;
  out = err = (x) => {
    has = true;
  }
  try { // it doesn't matter if it fails
    _fflush(0);
    // also flush in the JS FS layer
    ['stdout', 'stderr'].forEach(function(name) {
      var info = FS.analyzePath('/dev/' + name);
      if (!info) return;
      var stream = info.object;
      var rdev = stream.rdev;
      var tty = TTY.ttys[rdev];
      if (tty && tty.output && tty.output.length) {
        has = true;
      }
    });
  } catch(e) {}
  out = oldOut;
  err = oldErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the Emscripten FAQ), or make sure to emit a newline when you printf etc.');
  }
}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

run();


// end include: postamble.js

// This file is merged with skiko.js and skiko.mjs by emcc
// It used by setup.js and setup.mjs (see in the same directory)

const SkikoCallbacks = (() => {
    const CB_NULL = {
        callback: () => { throw new RangeError("attempted to call a callback at NULL") },
        data: null
    };
    const CB_UNDEFINED = {
        callback: () => { throw new RangeError("attempted to call an uninitialized callback") },
        data: null
    };


    class Scope {
        constructor() {
            this.nextId = 1;
            this.callbackMap = new Map();
            this.callbackMap.set(0, CB_NULL);
        }

        addCallback(callback, data) {
            let id = this.nextId++;
            this.callbackMap.set(id, {callback, data});
            return id;
        }

        getCallback(id) {
            return this.callbackMap.get(id) || CB_UNDEFINED;
        }

        deleteCallback(id) {
            this.callbackMap.delete(id);
        }

        release() {
            this.callbackMap = null;
        }
    }

    const GLOBAL_SCOPE = new Scope();
    let scope = GLOBAL_SCOPE;

    return {
        _callCallback(callbackId, global = false) {
            let callback = (global ? GLOBAL_SCOPE : scope).getCallback(callbackId);
            try {
                callback.callback();
                return callback.data;
            } catch (e) {
                console.error(e)
            }
        },
        _registerCallback(callback, data = null, global = false) {
            return (global ? GLOBAL_SCOPE : scope).addCallback(callback, data);
        },
        _releaseCallback(callbackId, global = false) {
            (global ? GLOBAL_SCOPE : scope).deleteCallback(callbackId);
        },
        _createLocalCallbackScope() {
            if (scope !== GLOBAL_SCOPE) {
                throw new Error("attempted to overwrite local scope")
            }
            scope = new Scope()
        },
        _releaseLocalCallbackScope() {
            if (scope === GLOBAL_SCOPE) {
                throw new Error("attempted to release global scope")
            }
            scope.release()
            scope = GLOBAL_SCOPE
        },
    }
})();
// This file is merged with skiko.js by emcc

const { _callCallback, _registerCallback, _releaseCallback, _createLocalCallbackScope, _releaseLocalCallbackScope } = SkikoCallbacks;

var wasmSetup = new Promise(function(resolve, reject) {
    Module['onRuntimeInitialized'] = _ => {
        resolve(Module);
    };
});

function onWasmReady(onReady) { wasmSetup.then(onReady); }

// Warn about skiko.js redundancy in case of K/Wasm target:
console.warn("Note: skiko.js is redundant in K/Wasm Compose for Web applications. Consider removing it from index.html, it will be removed from the distribution in next Compose Multiplatform versions");