var mobservable = require('..');
var m = mobservable;

var observable = mobservable.observable;
var voidObserver = function(){};

function buffer() {
    var b = [];
    var res = function(newValue) {
        b.push(newValue);
    };
    res.toArray = function() {
        return b;
    };
    return res;
}

function testException(test, observable, exception) {
    try {
        var value = observable();
        test.fail("Expected exception: " + exception + ", got: " + value);
    }
    catch (e) {
        var message = "" + e;
        test.equal(message === exception || e.cause === exception || message.indexOf(exception) !== -1, true, "Expected exception '" + exception + "', got: " + e);
    }
    test.equal(mobservable._.isComputingView(), false);
}

exports.testException1  = function(test) {
    var a = observable(function() {
        throw "hoi";
    });
    testException(test, a, "hoi");
    test.equal(mobservable._.isComputingView(), false);
    test.done();
};

exports.testException2 = function(test) {
    var cbuffer = buffer();
    var z = observable(true);
    var x = observable(1);
    var a = observable(function() {
        if (z())
            return x();
        throw "Some error!";
    });
    var b = observable(function() {
        return a();
    });
    var c = observable(function() {
        return a();
    });
    c.observe(cbuffer, true);

    test.equal(a(), 1);
    test.throws(function() {
        z(false);
    });

    test.equal(z(), false);
    test.equal(a(), 1);
    test.equal(b(), 1);

    x(2);
    z(true);
    test.equal(a(), 2);
    test.equal(b(), 2);
    test.equal(cbuffer.toArray().length, 2);
    test.deepEqual(cbuffer.toArray(), [1,2]);
    test.equal(mobservable._.isComputingView(), false);

    test.done();
};

exports.deny_state_changes_in_views = function(test) {
    try {
        var x = observable(3);
        var z = observable(5);
        var y = observable(function() {
            z(6);
            return x() * x();
        });

        try {
            test.equal(9, y());
            test.fail("no exception");
        } catch(e) {
            test.ok(("" + e).indexOf('It is not allowed to change the state during the computation of a reactive view') > 0, "Invalid exception: " + e);
        }
    
        // y is broken now...
        test.equal(y(), undefined); 

        test.equal(mobservable._.isComputingView(), false);
        test.done();
    }
    catch(e) {
        console.log(e.stack);
    }
};

exports.allow_state_changes_in_non_strict_views = function(test) {
    var x = observable(3);
    var z = observable(5);
    var y = observable(function() {
        m.extras.withStrict(false, function() { 
            z(6);
        });
        return x() * x();
    });

    test.equal(9, y());
    test.equal(z(), 6);

    test.equal(mobservable._.isComputingView(), false);
    test.done();
};

exports.allow_state_changes_in_autorun = function(test) {
    var x = observable(3);
    var z = observable(3);
    
    m.autorun(function() {
        if (x() !== 3)
            z(x());
    });
    
    test.equal(x(), 3);
    test.equal(z(), 3);

    x(5); // autorunneres are allowed to change state

    test.equal(x(), 5);
    test.equal(z(), 5);

    test.equal(mobservable._.isComputingView(), false);
    test.done();
};

exports.deny_state_changes_in_autorun_if_strict = function(test) {
    var x = observable(3);
    var z = observable(3);
    
    m.autorun(function() {
        m.extras.withStrict(true, function() {
            if (x() !== 3)
                z(x());
        });
    });
    
    test.equal(x(), 3);
    test.equal(z(), 3);

    try {
        x(5);
        test.fail("no exception");
    } catch(e) {
        test.ok(("" + e).indexOf('It is not allowed to change the state during the computation of a reactive view') > 0, "Invalid exception: " + e);
    }

    test.equal(x(), 5);
    test.equal(z(), 3);

    test.equal(mobservable._.isComputingView(), false);
    test.done();
};

exports.deny_array_change_in_view = function(test) {
    try {
        var x = observable(3);
        var z = observable([]);
        var y = observable(function() {
            z.push(3);
            return x() * x();
        });

        try {
            test.equal(9, y());
            test.fail("no exception");
        } catch(e) {
            test.ok(("" + e).indexOf('It is not allowed to change the state during the computation of a reactive view') > 0, "Invalid exception: " + e);
        }
        
        test.deepEqual(z.slice(), []);
        test.equal(mobservable._.isComputingView(), false);

        test.done();
    }
    catch(e) {
        console.log(e.stack);
    }
};

exports.allow_array_change_in_autorun = function(test) {
    var x = observable(3);
    var z = observable([]);
    var y = m.autorun(function() {
        if (x() > 4)
            z.push(x());
    });
    
    x(5);
    x(6);
    test.deepEqual(z.slice(), [5, 6])
    x(2);
    test.deepEqual(z.slice(), [5, 6])

    test.equal(mobservable._.isComputingView(), false);

    test.done();
};

exports.throw_error_if_modification_loop = function(test) {
    var x = observable(3);
    try {
        var dis = m.autorun(function() {
            x(x() + 1);
        });
        x(5);
        test.equal(false, true, "expected exception");
    } catch(e) {
        test.ok((""+e).indexOf("Cycle detected") !== -1, "[mobservable] loop detected while updating a value");
    }
    test.done();
};

exports.cycle1 = function(test) {
    try {
        var p = observable(function() { return p() * 2; }); // thats a cycle!
        p.observe(voidObserver, true);
        test.fail("expected exception");
    }
    catch(e) {
        test.ok(("" + e).indexOf("Cycle detected") !== -1);
        test.equal(mobservable._.isComputingView(), false);
    }

    var a = observable(function() { return b() * 2; });
    var b = observable(function() { return a() * 2; });
    testException(test, b, "Cycle detected");
    test.done();
};

exports.cycle2 = function(test) {
    var p = observable(function() { return p() * 2; });
    testException(test, p, "Cycle detected");
    test.done();
};

exports.cycle3 = function(test) {
    var z = observable(true);
    var a = observable(function() { return z() ? 1 : b() * 2; });
    var b = observable(function() { return a() * 2; });

    b.observe(voidObserver);
    test.equals(1, a());

    try {
        z(false); // introduces a cycle!
        test.fail("expected exception");
    } catch(e) {
        test.ok(("" + e).indexOf("Cycle detected") > -1);
    }
    test.equal(b(), 2);
    testException(test, a, "Cycle detected");

    z(true); // cycle is gone, restore stable state
    test.equals(1, a());
    test.equals(2, b());

    test.equal(mobservable._.isComputingView(), false);
    test.done();
};
