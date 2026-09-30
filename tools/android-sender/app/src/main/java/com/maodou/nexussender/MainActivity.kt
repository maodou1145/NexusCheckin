package com.maodou.nexussender

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat

/**
 * Nexus 发送端：
 *  1) 内嵌 WebView 打开站点（真实浏览器内核，人机验证可正常通过）
 *  2) 「抓取 Token」：从网页 localStorage 里取 JWT
 *  3) 「开启共享」：起前台服务，把 Token 通过 8123 端口发给手表
 *
 * 界面会给出手表要填的地址（局域网 IP；另附 127.0.0.1 供端口转发场景），
 * 下方还有一块**实时日志**：手表连没连上、有没有取到 Token，一眼可见。
 */
class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView
    private lateinit var tvStatus: TextView
    private lateinit var tvAddr: TextView
    private lateinit var tvLog: TextView
    private lateinit var btnToggle: Button

    private val ui = Handler(Looper.getMainLooper())
    private val logTick = object : Runnable {
        override fun run() {
            refreshLog()
            ui.postDelayed(this, 1000L)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        web = findViewById(R.id.web)
        tvStatus = findViewById(R.id.tvStatus)
        tvAddr = findViewById(R.id.tvAddr)
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
        btnToggle.setOnClickListener { toggleShare() }

        if (Build.VERSION.SDK_INT >= 33) {
            try {
                ActivityCompat.requestPermissions(
                    this, arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1
                )
            } catch (e: Exception) {}
        }
        refreshUi()
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
                Toast.makeText(this, "没抓到 Token（先在下面网页里登录成功）", Toast.LENGTH_LONG).show()
                TokenService.log("抓取失败：页面里没找到 Token（先登录成功再试）")
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

    private fun refreshUi() {
        val hasToken = TokenService.token.isNotEmpty()
        tvStatus.text = "① 在下方网页登录 → ② 抓取 Token → ③ 开启共享" +
                if (hasToken) "\nToken：${TokenService.token.length} 字符 ✓" else "\nToken：未抓取"

        if (TokenService.running) {
            val ip = localIpv4()
            val sb = StringBuilder()
            sb.append("手表会自动先试 127.0.0.1；不通时请在手表的「改地址」里填这个 IP（端口 ${TokenService.PORT}）：\n")
            if (ip.isNotEmpty()) sb.append(ip) else sb.append("（没读到局域网 IP，检查手机是否连着 Wi-Fi/热点）")
            sb.append("\n备选：127.0.0.1\n（仅当手表那侧做了端口转发时才通）")
            tvAddr.text = sb.toString()
            btnToggle.text = "停止共享"
        } else {
            tvAddr.text = if (hasToken) "点「开启共享」后这里会显示手表要填的地址" else ""
            btnToggle.text = "开启共享"
        }
        refreshLog()
    }

    private fun refreshLog() {
        val lines = TokenService.recentLogs(40)
        tvLog.text = if (lines.isEmpty()) "（暂无日志）" else lines.joinToString("\n")
    }

    override fun onResume() {
        super.onResume()
        refreshUi()
        ui.removeCallbacks(logTick)
        ui.post(logTick)
    }

    override fun onPause() {
        super.onPause()
        ui.removeCallbacks(logTick)
    }

    override fun onDestroy() {
        ui.removeCallbacks(logTick)
        web.destroy()
        super.onDestroy()
    }
}
