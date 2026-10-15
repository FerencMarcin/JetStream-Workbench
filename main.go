package main

import (
	"embed"
	"fmt"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

// appVersion is set from wails.json by build-exe.ps1 during release builds.
var appVersion = "dev"

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:     fmt.Sprintf("JetStream Workbench v%s", appVersion),
		Width:     1280,
		Height:    820,
		MinWidth:  1000,
		MinHeight: 650,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup:  app.startup,
		OnShutdown: app.shutdown,
		Bind: []interface{}{
			app,
		},
	})
	if err != nil {
		log.Fatal(err)
	}
}
