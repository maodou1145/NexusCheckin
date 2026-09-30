package com.maodou.nexussender

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import android.widget.ViewFlipper
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat

/**
 * Nexus 发送端
 *
 * 界面分两屏（左右滑动切换，避免一屏塞太挤）：
 *   屏 1：状态 + 手表要填的地址 + 登录网页（WebView）
 *   屏 2：抓取 / 共享 / 清空日志 / 返回 + 实时日志
 *
 * 手表侧不需要用户填 127.0.0.1 —— 地址调度（含回环地址回退）都在手表内部自动完成，
 * 这里只显示手机在局域网里的 IP。
 */
class MainActivity : AppCompatActivity() {

    private lateinit var flipper: ViewFlipper
    private lateinit var web: WebView
    private lateinit var tvStatus: TextView
    private lateinit var tvAddr: TextView
    private lateinit var tvAddr2: TextView
    private lateinit var tvLog: TextView
    private lateinit var btnToggle: Button

    private val ui = Handler(Looper.getMainLooper())
    private val tick = object : Runnable {
        override fun run() {
            refreshLog()
            ui.postDelayed(this, 1000L)
        }
    }

    @SuppressLint("SetJavaScriptEnabled", "ClickableViewAccessibility")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        flipper = findViewById(R.id.flipper)
        web = findViewById(R.id.web)
        tvStatus = findViewById(R.id.tvStatus)
        tvAddr = findViewById(R.id.tvAddr)
        tvAddr2 = findViewById(R.id.tvAddr2)
        tvLog = findViewById(R.id.tvLog)
        btnToggle = findViewById(R.id.btnToggle)

        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.webViewClient = WebViewClient()
        web.loadUrl("https://ws.fseatech.cn")

        findViewById<Button>(R.id.btnGrab).setOnClickListener { grabToken() }
        findViewById<Button>(R.id.btnClearLog).setOnClickListener {
            TokenService.clearLogs()
            TokenService.log("日志已清空")
            refreshLog()
        }
        findViewById<Button>(R.id.btnBack).setOnClickListener { showPage(0) }
        btnToggle.setOnClickListener { toggleShare() }

        /* 手势：在顶部信息区左右滑动即可切换两屏
         * （WebView 会自己消费横向手势，所以手势区放在状态/地址/提示那几行上）*/
        val gd = GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {
            override fun onFling(e1: MotionEvent?, e2: MotionEvent, vx: Float, vy: Float): Boolean {
                if (e1 == null) return false
                val dx = e2.x - e1.x
                val dy = e2.y - e1.y
                if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) {
                    // 任意横向滑动都切换（不用记方向，最不容易出错）
                    showPage(if (flipper.displayedChild == 0) 1 else 0)
                    return true
                }
                return false
            }
        })
        val touch = View.OnTouchListener { v, ev ->
            gd.onTouchEvent(ev)
            false
        }
        tvStatus.setOnTouchListener(touch)
        tvAddr.setOnTouchListener(touch)
        findViewById<TextView>(R.id.tvSwipeHint).setOnTouchListener(touch)

        if (Build.VERSION.SDK_INT >= 33) {
            try {
                ActivityCompat.requestPermissions(
                    this, arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1
                )
            } catch (e: Exception) {}
        }
        refreshUi()
    }

    private fun showPage(i: Int) {
        if (flipper.displayedChild != i) {
            flipper.displayedChild = i
        }
    }

    /** 从网页里取 Token：先看 localStorage.token，否则遍历找 eyJ 开头的值 */
    private fun grabToken() {
        val js = """
            (function(){
              try {
                var t = localStorage.getItem('token');
                if (t && t.length > 40 && t.indexOf('eyJ') === 0) return t;
                for (var i = 0; i < localStorage.length; i++) {
                  var k = localStorage.key(i), v = localStorage.getItem(k);
                  if (typeof v === 'string' && v.length > 40) {
                    var s = v.trim();
                    if (s.indexOf('eyJ') === 0) return s;
                    if (s.charAt(0) === '{') {
                      try {
                        var o = JSON.parse(s);
                        var c = o.token || o.accessToken || o.access_token;
                        if (c && c.indexOf('eyJ') === 0) return c;
                      } catch (e) {}
                    }
                  }
                }
              } catch (e) {}
              return '';
            })()
        """.trimIndent()

        web.evaluateJavascript(js) { raw ->
            val t = raw?.trim('"')?.replace("\\u003d", "=")?.replace("\\/", "/") ?: ""
            if (t.length < 100 || !t.startsWith("eyJ")) {
                Toast.makeText(this, "没抓到 Token（先在登录页里登录成功）", Toast.LENGTH_LONG).show()
                TokenService.log("抓取失败：页面里没找到 Token（先登录成功再试）")
                showPage(1)
                return@evaluateJavascript
            }
            TokenService.token = t
            Toast.makeText(this, "已抓到 Token（${t.length} 字符）", Toast.LENGTH_LONG).show()
            TokenService.log("抓到 Token ✓ ${t.length} 字符")
            refreshUi()
        }
    }

    private fun toggleShare() {
        if (TokenService.token.isEmpty()) {
            Toast.makeText(this, "请先点「抓取 Token」", Toast.LENGTH_SHORT).show()
            TokenService.log("点「开启共享」但还没有 Token，已拦下")
            return
        }
        val it = Intent(this, TokenService::class.java)
        if (TokenService.running) {
            stopService(it)
        } else {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(it) else startService(it)
        }
        web.postDelayed({ refreshUi() }, 500)
    }

    /** 手表只需填手机在局域网里的 IP；回环地址由手表内部自动回退尝试，不需要用户操心 */
    private fun addrText(): String {
        if (!TokenService.running) {
            return if (TokenService.token.isNotEmpty()) "点「开启共享」后这里会显示手表要填的 IP" else ""
        }
        val ip = localIpv4()
        return if (ip.isEmpty()) {
            "没读到局域网 IP —— 检查手机是否连着 Wi-Fi 或热点（端口 ${TokenService.PORT}）"
        } else {
            "手表填这个 IP（端口 ${TokenService.PORT}）：\n$ip\n手表会自动尝试连接，无需其他设置"
        }
    }

    private fun refreshUi() {
        val hasToken = TokenService.token.isNotEmpty()
        tvStatus.text = "① 在下方网页登录 → ② 滑到右侧「抓取 Token」→ ③ 开启共享" +
                if (hasToken) "\nToken：${TokenService.token.length} 字符 ✓" else "\nToken：未抓取"
        tvAddr.text = addrText()
        tvAddr2.text = addrText()
        btnToggle.text = if (TokenService.running) "停止共享" else "开启共享"
        refreshLog()
    }

    private fun refreshLog() {
        val lines = TokenService.recentLogs(60)
        tvLog.text = if (lines.isEmpty()) "（暂无日志）" else lines.joinToString("\n")
    }

    @Deprecated("兼容旧回调")
    override fun onBackPressed() {
        if (flipper.displayedChild == 1) {
            showPage(0)
            return
        }
        @Suppress("DEPRECATION")
        super.onBackPressed()
    }

    override fun onResume() {
        super.onResume()
        refreshUi()
        ui.removeCallbacks(tick)
        ui.post(tick)
    }

    override fun onPause() {
        super.onPause()
        ui.removeCallbacks(tick)
    }

    override fun onDestroy() {
        ui.removeCallbacks(tick)
        web.destroy()
        super.onDestroy()
    }
}
