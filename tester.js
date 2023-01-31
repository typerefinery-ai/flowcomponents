require('total4');

const Path = require('path');
const Fs = require('fs');
const TestAll = process.mainModule.exports === exports;

// Loggers
const logSuccess = function(test) {
	const tester = test.tester || test.__tester__;
	tester.stats.total++;
	tester.stats.ok++;

	const name = test.__description__;
	const duration = '(' + (new Date() - test.beg) + ' ms)';
	console.log('[OK]', test.__name__, (name ? '- ' + name : ''), duration);
    if (test.log) {
        console.log(test.log.join('\r\n'));
    }

	delete test.__tester__;
	delete test.__name__;
};

const logFailed = function(test) {
	const tester = test.tester || test.__tester__;
	tester.stats.total++;
	tester.stats.failed++;

	const name = test.__description__;
	const duration = '(' + (new Date() - test.beg) + ' ms)';
	console.log('[FAILED]', test.__name__, (name ? '- ' + name : ''), duration);
    if (test.log) {
        console.log(test.log.join('\r\n'));
    }

	delete test.__tester__;
	delete test.__name__;
};

const logMessage = function(test, message) {
    if (!test.log) {
        test.log = [];
    }
    test.log.push(message);
};

// Tester
const tester = {};
tester.path = './components';
tester.timeout = 5 * 1000;
tester.inputTests = {};
tester.tests = {};
tester.stats = { total: 0, ok: 0, failed: 0 };
tester.log = [];

tester.output = function(msg) {
	const test = this.tests[msg.fromid];
	const inputTest = tester.inputTests[msg.fromid + '_' + msg.__input__];

	// Global message catch
	test.output && test.output(msg);
	test.message && test.message(msg);

	// Input with callback
	if (inputTest) {
		inputTest.output && inputTest.output(msg);
		inputTest.message && inputTest.message(msg);

		inputTest.resolve(msg);
		inputTest.handler && inputTest.handler(msg);
	}
};

tester.finish = tester.done = function(message) {
	setTimeout(() => {
		const duration = new Date() - tester.beg;

		var div = '|--------------------------------------|';

		if (message) {
			console.log(div);
			console.log(message);
		}

        var status = tester.stats.failed > 0 ? 'FAILED' : 'OK';

		console.log(div);
		console.log('| Total              |', tester.stats.total.padLeft(15, ' '), '|');
		console.log('| Success            |', tester.stats.ok.padLeft(15, ' '), '|');
		console.log('| Failed             |', tester.stats.failed.padLeft(15, ' '), '|');
		console.log('| Duration           |', (duration + ' ms').padLeft(15, ' '), '|');
		console.log(div);
		tester.stop();
	}, 5);
};

tester.end = tester.throw = tester.fail = function(message) {
	console.log('[NO]' + (message ? ' - ' + message : ''));
	this.stop();
};

tester.stop = function() {
	this.timeoutid && clearTimeout(this.timeoutid);
	this.flowstream && this.flowstream.destroy();
	this.flowstream = null;
	this.timeoutid = null;
	process.exit(this.stats.failed > 0);
};

// this is the 'describe' function in require('../tester')(async function(describe, done) {
tester.test = function(name, callback) {

	let testName = name;

	// Optional name parameter
	if (typeof (name) === 'function') {
		testName = U.getName(process.mainModule.filename).replace(/\.js$/, '');
		callback = name;
	}

	const componentPath = Path.join(__dirname, tester.path, testName + '.html');

	let testPromiseResolver;
	const testPromise = new Promise(resolve => testPromiseResolver = resolve);

	Fs.readFile(componentPath, 'utf8', (err, data) => {
		if (err) {
			console.error(err);
			return;
		}

		const flow = tester.flowstream;

		// Connection Ids
		const componentConnectionId = 'com_' + testName + '_' + UID();
		const dummyConnectionId = 'com_DUMMY_' + UID();
		tester.dummyConnection = [{ id: dummyConnectionId, index: 'input' }];

		// Register DUMMY component
		flow.register('DUMMY', instance => {
			instance.inputs = [{ id: 'input', name: 'Input' }];

			instance.message = function(msg) {
				msg.__tester__ = tester;
				msg.__input__ = instance.__input__;
				tester.output(msg);
			};
		});

		// Add DUMMY component to flowstream
		flow.use(`{
			"${dummyConnectionId}": {
				"component": "DUMMY",
				"connections": {}
			}
		}`, function() {
			// Add component to flowstream
			var comp = flow.add(testName, data);

			let conns = {};
			let is;

			// add connection from every output to DUMMY compponent
			(comp.outputs || []).forEach(function(c){
				is = true;
				return conns[c.id] = tester.dummyConnection;
			});

			if (!is)
				conns = { output: tester.dummyConnection };

			const componentConnection = { [componentConnectionId]: { component: testName, connections: conns } };

			// Connect component to DUMMY component
			flow.insert(componentConnection, function() {

				if (callback) {
					const id = componentConnectionId;
					const instance = flow.meta.flow[id];
					const testInstance = flow.meta.flow[dummyConnectionId];

					const test = {};

					test.input = function(inputIndex, data, handler) {

						// Optional input index
						if (typeof (inputIndex) !== 'string') {
							inputIndex = data;
							data = handler;
						}

						// Tell DUMMY component, that next incoming message is from "inputIndex"
						testInstance.__input__ = inputIndex;

						const inputTest = {};
						inputTest.handler = handler;

						const promise = new Promise(resolve => {
							inputTest.resolve = resolve;
						});

						tester.inputTests[id + '_' + inputIndex] = inputTest;

						// Send data to component
						flow.trigger(id + '__' + inputIndex, data);

						return promise;
					};

					// Handlers
					test.ok = function(value, description) {
                        
                        if (!test.log) {
                            test.log = [];
                        }
                        test.log.push("DFFF");
                        
						if (typeof value === 'string')
							description = value;

						this.__name__ = instance.module.name;
						this.__description__ = description;

						if (typeof (value) === 'undefined') {
							logSuccess(this);
							return;
						}

						if (value)
							logSuccess(this);
						else
							logFailed(this);

						delete this.__description__;
					};

					test.fail = function(value, description) {

						if (typeof value === 'string')
							description = value;

						this.__name__ = instance.module.name;
						this.__description__ = description;

						if (typeof (value) === 'undefined') {
							logFailed(this);
							return;
						}

						if (value)
							logFailed(this);
						else
							logSuccess(this);

						delete this.__description__;
					};

					test.tester = tester; // Reference to main tester instance
					test.default_config = instance.config;
					test.config = instance.config;
					test.instance = instance;
					test.beg = new Date();

					// Change config of component
					test.configure = test.reconfigure = function(properties, withoutConfigure) {
						instance.config = test.default_config;

						for (let key in properties)
							instance.config[key] = properties[key];

						!withoutConfigure && instance.configure && instance.configure();
					};

					// Trigger
					test.trigger = function(data) {
						instance.trigger(data);
					};

					tester.tests[id] = test;

					callback(test, testPromiseResolver);

					instance.onerror = test.onerror;
					instance.onError = test.onError;
				}
			});
		});
	});

	return testPromise;
};

module.exports = function(callback) {

	const flow = tester.flowstream = FLOWSTREAM('Test');

	flow.onstatus = function(status) {
		const test = tester.tests[this.id];
		if (!test)
			return;
		test.status && test.status(status);
		test.current_status = status;
	};

	flow.ondashboard = function(status) {
		const test = tester.tests[this.id];
		test.dashboard && test.dashboard(status);
		test.current_dashboard = status;
	};

	flow.onerror = function(a, b, c, d) {
		const test = tester.tests[this.id];
		test.onError && test.onError(a, b, c, d);
		test.onerror && test.onerror(a, b, c, d);
	};

	flow.onconnect = function(instance) {
		instance.httproute = NOOP;
		instance.save = function() {
			if (instance.outputs && instance.outputs.length) {
				instance.connections = {};
				instance.outputs.forEach(function(out){
					instance.connections[out.id] = tester.dummyConnection;
				});
			}
		};
		instance.io = NOOP;
		instance.toinput = NOOP;
		instance.output = NOOP;
		instance.newvariables = function(vars) {
			instance.variables && instance.variables(vars);
		};
		instance.reconfigure = function(conf){
			for (let key in conf)
				instance.config[key] = conf[key];
			instance.configure && instance.configure();
		};
	};

	tester.beg = new Date();
	callback.call(tester, tester.test, tester.done);

	// Start "Timeout" timer
	tester.timeoutid = setTimeout(() => {
		tester.done();
	}, tester.timeout);
};

if (TestAll) {
	// Run all test scripts
	F.Fs.readdir('tests', function(err, files) {
		tester.beg = Date.now();
		files.wait(function(file, next) {

			if (U.getExtension(file) === 'js') {

				tester.stats.total++;

				var now = Date.now();
				var child = F.Child.fork('tests/' + file, { detached: true, silent: true });

				child.on('exit', function(code) {

					if (code)
						tester.stats.failed++;
					else
						tester.stats.ok++;

					var ms = Date.now() - now;
					console.log('[{0}] '.format(code ? 'FAILED' : 'OK') + file + ' ({0} s)'.format((ms / 1000).toFixed(2)));
					next();

				});

			} else
				next();

		}, tester.done);
	});
}