//亮點展示圖之檢視: 畫布依視窗縮放; 滾輪以游標為中心放大(最多 12 倍), 拖曳平移, 雙擊還原, 供確認細節; 不影響截圖(預設 1920x1080 時比例為 1)
(function () {
    var s = document.querySelector('.stage');
    var z = 1, x = 0, y = 0, base = 1, ox = 0, oy = 0, d = null;
    function apply() {
        s.style.transform = 'translate(' + (ox + x) + 'px,' + (oy + y) + 'px) scale(' + (base * z) + ')';
    }
    function fit() {
        base = Math.min(innerWidth / 1920, innerHeight / 1080);
        ox = (innerWidth - 1920 * base) / 2;
        oy = (innerHeight - 1080 * base) / 2;
        apply();
    }
    addEventListener('resize', fit);
    addEventListener('wheel', function (e) {
        e.preventDefault();
        var nz = Math.min(12, Math.max(1, z * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
        var cx = e.clientX - ox - x, cy = e.clientY - oy - y;
        x -= cx * (nz / z - 1);
        y -= cy * (nz / z - 1);
        z = nz;
        if (z === 1) { x = 0; y = 0; }
        apply();
    }, { passive: false });
    addEventListener('mousedown', function (e) { e.preventDefault(); d = { x: e.clientX - x, y: e.clientY - y }; });
    addEventListener('mousemove', function (e) { if (d) { x = e.clientX - d.x; y = e.clientY - d.y; apply(); } });
    addEventListener('mouseup', function () { d = null; });
    addEventListener('dblclick', function () { z = 1; x = 0; y = 0; apply(); });
    fit();
})();
