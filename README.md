# meBarista-for-Linux
This is a fork of the discontinued meBarista chrome app which has been made into an electron app and runs on linux. 

>As of writing meCoffee and meBarista have been taken offline, so this now seems to be the only way to control the meCoffee PID which isn't through an android device, as the IOS version also fails to work and the chrome app has been deprecated. This was pulled from an exposed GIT repo on the site and then modified to work with electron.

### Instructions
* Clone the repo
* Connect to the meCoffee PID with bluetooth, the usual pin is `4321` and it will then immediately disconnect. The PID is designed to do this when not operated entirely through the app
* Use `NPM start` to launch the app
* Choose meCoffee in the dropdown settings and press `Start`

Most of the app is self explanatory, the Help pages are currently missing as meCoffee seems to now be totally offline 
