#include <windows.h>
#include <iostream>
#include <string>
#include <sstream>
#include <napi.h>
using namespace std;

Napi::Value Method(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (!info[0].IsString()) {
        Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    string syka = info[0].As<Napi::String>();
    stringstream ssFilePath;
    ssFilePath << syka;
    cout << "Path: " << ssFilePath.str().c_str();
    int result = SystemParametersInfoA(SPI_SETDESKWALLPAPER, 0, (PVOID)ssFilePath.str().c_str(), SPIF_UPDATEINIFILE | SPIF_SENDCHANGE);
    return Napi::String::New(env, syka);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "changeWallpaper"),
        Napi::Function::New(env, Method));
    return exports;
}

bool exists(const std::string& name) {
    struct stat buffer;
    return (stat(name.c_str(), &buffer) == 0);
}

NODE_API_MODULE(changeWallpaper, Init)