// Servizio upload asset su ImageKit — solo server-side.
// Porting da src/lib/imagekitService.js

import ImageKit from 'imagekit'

let _ik: InstanceType<typeof ImageKit> | null = null

function getIK(): InstanceType<typeof ImageKit> {
  if (!_ik) {
    _ik = new ImageKit({
      publicKey:   process.env.IMAGEKIT_PUBLIC_KEY   ?? '',
      privateKey:  process.env.IMAGEKIT_PRIVATE_KEY  ?? '',
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT ?? '',
    })
  }
  return _ik
}

// Carica un Buffer su ImageKit e restituisce l'URL pubblico.
export async function uploadBuffer(buffer: Buffer, fileName: string, folder = '/impero-waifu'): Promise<string> {
  const ik = getIK()
  const result = await ik.upload({
    file: buffer,
    fileName,
    folder,
    useUniqueFileName: false,
    overwriteFile: true,
    isPublished: true,
  } as Parameters<typeof ik.upload>[0])
  return (result as any).url as string
}

// Genera i parametri di autenticazione per l'upload diretto browser → ImageKit.
export function getUploadAuthParams(): { token: string; expire: number; signature: string; publicKey: string; urlEndpoint: string } {
  const ik = getIK()
  const auth = ik.getAuthenticationParameters()
  return {
    ...auth,
    publicKey:   process.env.IMAGEKIT_PUBLIC_KEY   ?? '',
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT ?? '',
  }
}
