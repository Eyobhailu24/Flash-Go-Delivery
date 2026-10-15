/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { orderPayableTotal } from '../src/lib/pricing';
import { parseMapFlag } from '../src/lib/map-config';
import { leafletHtml } from '../src/components/maps/leaflet-html';
import { normalizeEthiopiaPhone } from '../src/lib/ethiopia-phone';

test('phone normalization accepts local formats and rejects overflow or malformed input', () => {
  for (const input of [
    '+251911223344',
    '251911223344',
    '0911223344',
    '911223344',
    '(091) 122-3344',
  ]) {
    assert.equal(normalizeEthiopiaPhone(input), '+251911223344');
  }
  assert.equal(normalizeEthiopiaPhone('0711223344'), '+251711223344');
  for (const input of [
    '9112233445',
    '+2519112233445',
    '91122334',
    'hello911223344',
    '+1911223344',
    '0811223344',
  ]) {
    assert.equal(normalizeEthiopiaPhone(input), null);
  }
});

test('order total includes fees, preserves server amount and decimal cents', () => {
  assert.equal(
    orderPayableTotal({
      totalPrice: '450.00',
      deliveryFee: '50.00',
      serviceCharge: '50.00',
    }),
    '550.00',
  );
  assert.equal(
    orderPayableTotal({
      totalPrice: '0.10',
      deliveryFee: '0.20',
      serviceCharge: '0.00',
    }),
    '0.30',
  );
  assert.equal(
    orderPayableTotal({
      totalPrice: '100.00',
      deliveryFee: '50.00',
      serviceCharge: '50.00',
      payment: { amount: '180.00' },
    }),
    '180.00',
  );
});
test('map environment switch rejects accidental truthy strings', () => {
  assert.equal(parseMapFlag('false'), false);
  assert.equal(parseMapFlag(undefined), false);
  assert.equal(parseMapFlag('true'), true);
  assert.throws(() => parseMapFlag('FALSE'));
  assert.throws(() => parseMapFlag('0'));
});
test('map titles cannot break out of embedded JavaScript', () => {
  const title = '</script><script>alert("injected")</script>';
  const html = leafletHtml({
    markers: [{ latitude: 9, longitude: 38, title }],
  });
  assert.ok(!html.includes(title));
  assert.ok(html.includes('label.textContent=p.title'));
  assert.ok(html.includes('window.flashgoUpdate='));
  assert.ok(!html.includes('<script src='));
});
