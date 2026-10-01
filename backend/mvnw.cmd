@REM ----------------------------------------------------------------------------
@REM Maven Wrapper startup batch script for Windows
@REM Uses project-local Maven at .m2/wrapper/dists/apache-maven-3.9.9/
@REM ----------------------------------------------------------------------------

@echo off
setlocal

set MAVEN_PROJECTBASEDIR=%~dp0
set MAVEN_HOME=%MAVEN_PROJECTBASEDIR%.m2\wrapper\dists\apache-maven-3.9.9

if not exist "%MAVEN_HOME%\bin\mvn.cmd" (
    echo [ERROR] Maven not found at %MAVEN_HOME%
    echo Please run the setup script first or install Maven globally.
    exit /b 1
)

"%MAVEN_HOME%\bin\mvn.cmd" %*
