(async function () {
  const baseUrl =
    process.env.BASE_URL || "http://localhost:3000/api/v1/agridirect";
  const log = (label, obj) =>
    console.log("\n=== " + label + " ===\n", JSON.stringify(obj, null, 2));

  const doRequest = async (path, opts = {}) => {
    const res = await fetch(baseUrl + path, opts);
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: res.status, body };
  };

  try {
    // 1. Register farmer
    let r = await doRequest("/user/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Farmer1",
        email: "farmer1@test.local",
        password: "pass123",
        role: "farmer",
      }),
    });
    log("register farmer", r);

    // 2. Login farmer
    r = await doRequest("/user/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "farmer1@test.local",
        password: "pass123",
      }),
    });
    log("login farmer", r);
    const farmerToken = r.body?.accessToken;

    // 3. Create product (JSON)
    r = await doRequest("/product", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + farmerToken,
      },
      body: JSON.stringify({ name: "Tomato", price: 2.5, unit: "kg" }),
    });
    log("create product", r);
    const productId = r.body?.product?._id || (r.body && r.body._id) || null;

    // 4. Register buyer
    r = await doRequest("/user/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Buyer1",
        email: "buyer1@test.local",
        password: "pass123",
        role: "user",
      }),
    });
    log("register buyer", r);

    // 5. Login buyer
    r = await doRequest("/user/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "buyer1@test.local", password: "pass123" }),
    });
    log("login buyer", r);
    const buyerToken = r.body?.accessToken;

    // 6. Create order
    r = await doRequest("/order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + buyerToken,
      },
      body: JSON.stringify({ items: [{ product: productId, quantity: 2 }] }),
    });
    log("create order", r);
    const orderId = r.body?.order?._id || (r.body && r.body._id) || null;

    // 7. List products
    r = await doRequest("/product");
    log("list products", r);

    // 8. Buyer list orders
    r = await doRequest("/order", {
      headers: { Authorization: "Bearer " + buyerToken },
    });
    log("buyer orders", r);

    // 9. Farmer list orders
    r = await doRequest("/order", {
      headers: { Authorization: "Bearer " + farmerToken },
    });
    log("farmer orders", r);

    // 10. Update order status
    r = await doRequest("/order/" + orderId + "/status", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + farmerToken,
      },
      body: JSON.stringify({ status: "Accepted" }),
    });
    log("update status", r);

    // 11. Get order
    r = await doRequest("/order/" + orderId, {
      headers: { Authorization: "Bearer " + buyerToken },
    });
    log("get order", r);

    console.log("\nSMOKE TEST COMPLETE");
  } catch (err) {
    console.error("SMOKE TEST ERROR", err);
    process.exit(1);
  }
})();
