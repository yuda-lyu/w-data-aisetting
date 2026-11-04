//選色器: 配色來回多輪時, 讓使用者直接挑同組裝飾色之左右兩端, 中間依色相最短路徑內插; 定稿後移除本檔之引用
//用法: 放在畫布之後 <script src="color-tool.js" data-colors="#AAAAAA,#BBBBBB,..."></script>, data-colors 依序為畫面上現用之各色(由左而右)
//只在實際瀏覽器顯示, 截圖與檢核環境(navigator.webdriver)不顯示, 不影響輸出之圖
(function () {
    if (navigator.webdriver) { return; }
    var base = document.currentScript.dataset.colors.split(',');
    var targets = base.map(function (hex) {
        var els = document.querySelectorAll('.stage [fill="' + hex + '"], .stage [style*="' + hex + '"]');
        return Array.prototype.map.call(els, function (el) {
            return { el: el, hex: hex, isFill: el.getAttribute('fill') === hex, style: el.getAttribute('style') };
        });
    });
    function toHsl(hex) {
        var r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
        var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2, h = 0;
        if (d > 0) { h = mx === r ? ((g - b) / d + 6) % 6 : (mx === g ? (b - r) / d + 2 : (r - g) / d + 4); }
        return [h * 60, d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), l];
    }
    function toHex(h, s, l) {
        var a = s * Math.min(l, 1 - l);
        function f(n) {
            var k = (n + h / 30) % 12;
            var v = Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255).toString(16);
            return (v.length < 2 ? '0' : '') + v;
        }
        return ('#' + f(0) + f(8) + f(4)).toUpperCase();
    }
    function apply(cL, cR) {
        var a = toHsl(cL), b = toHsl(cR), dh = ((b[0] - a[0] + 540) % 360) - 180, n = targets.length - 1;
        targets.forEach(function (list, i) {
            var t = n > 0 ? i / n : 0, c = toHex((a[0] + dh * t + 360) % 360, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
            list.forEach(function (v) {
                if (v.isFill) { v.el.setAttribute('fill', c); } else { v.el.setAttribute('style', v.style.split(v.hex).join(c)); }
            });
        });
    }
    function row(id, label, c) {
        return '<label style="display:flex;align-items:center;gap:8px;margin-top:6px">' + label + '<input id="' + id + '" type="color" value="' + c.toLowerCase() + '" style="width:44px;height:26px;padding:0;border:1px solid #C5CFDA;background:#FFF;cursor:pointer"><span id="' + id + 'V" style="font-family:Consolas,monospace">' + c + '</span></label>';
    }
    var box = document.createElement('div');
    box.id = 'colorTool';
    box.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9999;padding:10px 12px;background:#FFF;border:1px solid #C5CFDA;border-radius:8px;font:14px "Microsoft JhengHei",sans-serif;color:#0F1E30;cursor:default';
    box.innerHTML = '<div style="font-weight:700">同組色系</div>' + row('cL', '左側', base[0]) + row('cR', '右側', base[base.length - 1]) + '<button id="cReset" type="button" style="margin-top:8px;width:100%;height:28px;border:0;border-radius:4px;background:#E4EAF1;color:#0F1E30;font:inherit;cursor:pointer">還原</button>';
    document.body.appendChild(box);
    //viewer.js 之平移與縮放掛在 window, 操作選色器時不觸發
    ['mousedown', 'mouseup', 'mousemove', 'wheel', 'dblclick'].forEach(function (n) {
        box.addEventListener(n, function (e) { e.stopPropagation(); });
    });
    var iL = document.getElementById('cL'), iR = document.getElementById('cR');
    function update() {
        document.getElementById('cLV').textContent = iL.value.toUpperCase();
        document.getElementById('cRV').textContent = iR.value.toUpperCase();
        apply(iL.value, iR.value);
    }
    iL.addEventListener('input', update);
    iR.addEventListener('input', update);
    document.getElementById('cReset').addEventListener('click', function () {
        iL.value = base[0].toLowerCase();
        iR.value = base[base.length - 1].toLowerCase();
        document.getElementById('cLV').textContent = base[0];
        document.getElementById('cRV').textContent = base[base.length - 1];
        targets.forEach(function (list) {
            list.forEach(function (v) {
                if (v.isFill) { v.el.setAttribute('fill', v.hex); } else { v.el.setAttribute('style', v.style); }
            });
        });
    });
})();
