// FlowStream Tester
// Component: theme.html

require('../tester')(async function(describe, done) {

    //test if we can input theme and output it using configured logic
    await describe(function(test, next) {

        // Test string
        test.configure({ code: "$.send('output', data);" });
        test.output = function(msg) {
            test.fail(msg.data === 'THEME_CODE', 'Theme data');
        };

        test.input('THEME_CODE');
        //test.trigger();

    });

    // test if we can override with code block output being sent
    await describe(function(test, next) {

        // Test string
        test.configure({ code: "$.send('output', 'test');" });
        test.output = function(msg) {
            test.fail(msg.data === 'test', 'Theme data');
        };

        test.input('THEME_CODE');
        //test.trigger();

    });

    // test if we can add to input content using code block
    await describe(function(test, next) {

        // Test string
        test.configure({ code: "$.send('output', '_' + data);" });
        test.output = function(msg) {
            test.fail(msg.data === '_THEME_CODE', 'Theme data');
        };

        test.input('THEME_CODE');
        //test.trigger();

    });

    // End test
    done();

});