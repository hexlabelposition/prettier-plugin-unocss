// Icons from installed @iconify-json/* packages are not loaded: they are
// unknown classes, as in the ESLint rule
<a className="foo i-svg-spinners-180-ring bar flex" />;
<a className="p-4 i-svg-spinners:180-ring foo" />;

// Custom collections from the config are known
<a className="p-4 foo i-custom-dot flex" />;
<a className="hover:i-custom-dot i-custom-dot p-4" />;
