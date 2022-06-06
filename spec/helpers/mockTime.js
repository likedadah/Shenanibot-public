beforeAll(function() {
  // ...because jasmine.clock().withMock() isn't working with an async fn 
  this.withMockTime = async fn => {
    jasmine.clock().install();
    try {
      await fn();
    } finally {
      jasmine.clock().uninstall();
    }
  };
});
