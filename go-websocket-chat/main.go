package main

import (
	"flag"
	"go/build"
	"log"
	"net/http"
	"path/filepath"
	"text/template"
)

var (
	addr      = flag.String("addr", ":8443", "http service address")
	assets    = flag.String("assets", defaultAssetPath(), "path to assets")
	homeTempl *template.Template
)

func defaultAssetPath() string {
	p, err := build.Default.Import("github.com/sowbug/gary.burd.info/go-websocket-chat", "", build.FindOnly)
	if err != nil {
		return "."
	}
	return p.Dir
}

func homeHandler(c http.ResponseWriter, req *http.Request) {
	homeTempl.Execute(c, req.Host)
}

func main() {
	flag.Parse()
	homeTempl = template.Must(template.ParseFiles(filepath.Join(*assets, "home.html")))
	h := newHub()
	go h.run()
	http.HandleFunc("/", homeHandler)
	http.Handle("/ws", wsHandler{h: h})

	staticFileServer := http.FileServer(http.Dir(filepath.Join(*assets, "/")))
	http.Handle("/static/", staticFileServer)

	if err := http.ListenAndServeTLS(*addr, "fullchain.pem", "0000_key-letsencrypt.pem", nil); err != nil {
		log.Fatal("ListenAndServe:", err)
	}
}
