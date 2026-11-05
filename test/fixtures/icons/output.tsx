// Icons from installed @iconify-json/* packages are not loaded: they are
// unknown classes, as in the ESLint rule
<a className="foo i-svg-spinners-180-ring bar flex" />;
<a className="i-svg-spinners:180-ring foo p-4" />;

// Custom collections from the config are known
<a className="foo i-custom-dot flex p-4" />;
<a className="i-custom-dot p-4 hover:i-custom-dot" />;
